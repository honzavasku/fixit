-- ============================================================================
-- FixIt – databázové schéma pro Supabase (PostgreSQL)
-- Spusť JEDNOU ručně: Supabase → SQL Editor → New query → vlož celý soubor → Run.
-- Pak spusť supabase/seed.sql. Skript je opakovatelný (idempotentní).
--
-- Bezpečnostní model:
--   * Row Level Security (RLS) je zapnuté u všech tabulek.
--   * Anonymně (bez přihlášení) se čtou jen: categories, price_guides, craftsmen
--     (jen bezpečné sloupce), availability_*, craftsman_categories a kontakty
--     DEMO řemeslníků.
--   * Zapisovat smí přihlášený uživatel jen řádky, které mu patří (user_id = auth.uid()).
--   * Demo řemeslníci (is_demo = true, user_id = null) nejdou přes API změnit ani smazat.
--   * Do prohlížeče patří JEN anon klíč. Klíč service_role nikdy.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Tabulky
-- ---------------------------------------------------------------------------

-- Profil uživatele (1:1 s auth.users). Vzniká automaticky triggerem níže.
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  role         text not null default 'client' check (role in ('client', 'craftsman')),
  display_name text not null default '' check (char_length(display_name) <= 60),
  created_at   timestamptz not null default now()
);

-- Strom kategorií (max. 3 úrovně, hlídá trigger). `icon` je klíč ikony v aplikaci,
-- `keywords` jsou slova bez diakritiky pro určení oboru z textu (classifyProblem).
create table if not exists public.categories (
  id         text primary key,
  parent_id  text references public.categories(id) on delete restrict,
  name       text not null,
  slug       text not null unique,
  icon       text,
  keywords   text[] not null default '{}',
  sort_order integer not null default 0
);
create index if not exists categories_parent_idx on public.categories(parent_id);

-- Řemeslníci. Kontakty jsou ve zvláštní tabulce (craftsman_contacts).
create table if not exists public.craftsmen (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid unique references public.profiles(id) on delete cascade,  -- null = demo řemeslník
  is_demo       boolean not null default false,
  name          text not null check (char_length(name) between 1 and 60),
  role_title    text not null check (char_length(role_title) between 1 and 60),
  town          text not null check (char_length(town) between 1 and 60),
  lat           double precision not null check (lat between -90 and 90),
  lng           double precision not null check (lng between -180 and 180),
  description   text not null default '' check (char_length(description) <= 500),
  hourly_rate   integer check (hourly_rate between 0 and 10000),               -- Kč/h, nepovinná
  verified      boolean not null default false,
  rating        numeric(2, 1) check (rating between 1 and 5),                  -- jen ukázková data
  review_count  integer not null default 0 check (review_count >= 0),
  sample_review jsonb,                                                         -- {author, stars, text}
  created_at    timestamptz not null default now(),
  constraint craftsmen_demo_has_no_user check (
    (is_demo and user_id is null) or (not is_demo and user_id is not null)
  )
);

-- Telefon a e-mail. Anonymně jsou čitelné jen kontakty DEMO řemeslníků (smyšlené).
create table if not exists public.craftsman_contacts (
  craftsman_id uuid primary key references public.craftsmen(id) on delete cascade,
  phone        text check (char_length(phone) <= 30),
  email        text check (char_length(email) <= 80)
);

create table if not exists public.craftsman_categories (
  craftsman_id uuid not null references public.craftsmen(id) on delete cascade,
  category_id  text not null references public.categories(id) on delete cascade,
  primary key (craftsman_id, category_id)
);
create index if not exists craftsman_categories_cat_idx on public.craftsman_categories(category_id);

-- Orientační ceny. max_czk = null znamená „od cca min_czk“. Údaje jsou ILUSTRATIVNÍ.
create table if not exists public.price_guides (
  id                          bigint generated always as identity primary key,
  category_id                 text not null references public.categories(id) on delete cascade,
  unit                        text not null check (unit in ('h', 'm2', 'ks')),   -- Kč/h, Kč/m², Kč/ks
  min_czk                     integer not null check (min_czk >= 0),
  max_czk                     integer check (max_czk is null or max_czk >= min_czk),
  callout_min_czk             integer check (callout_min_czk >= 0),
  callout_max_czk             integer check (callout_max_czk >= 0),
  typical_hours_min           numeric(5, 1) check (typical_hours_min >= 0),
  typical_hours_max           numeric(5, 1) check (typical_hours_max >= 0),
  emergency_surcharge_pct_min integer check (emergency_surcharge_pct_min >= 0),
  emergency_surcharge_pct_max integer check (emergency_surcharge_pct_max >= 0),
  note                        text,
  source                      text,
  is_illustrative             boolean not null default true,
  unique (category_id, unit)
);

-- Týdenní okna: weekday 1 = pondělí … 7 = neděle.
create table if not exists public.availability_rules (
  id           bigint generated always as identity primary key,
  craftsman_id uuid not null references public.craftsmen(id) on delete cascade,
  weekday      smallint not null check (weekday between 1 and 7),
  start_time   time not null,
  end_time     time not null,
  check (end_time > start_time)
);
create index if not exists availability_rules_craftsman_idx on public.availability_rules(craftsman_id);

-- Výjimky: is_available = false → ten den nepracuje;
--          is_available = true  → pracuje (dle týdenních oken, jinak výchozí 8:00–16:00).
create table if not exists public.availability_exceptions (
  id           bigint generated always as identity primary key,
  craftsman_id uuid not null references public.craftsmen(id) on delete cascade,
  date         date not null,
  is_available boolean not null default false,
  note         text check (char_length(note) <= 80),
  unique (craftsman_id, date)
);

create table if not exists public.favorites (
  user_id      uuid not null references public.profiles(id) on delete cascade,
  craftsman_id uuid not null references public.craftsmen(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (user_id, craftsman_id)
);

-- ---------------------------------------------------------------------------
-- 2) Funkce a triggery
-- ---------------------------------------------------------------------------

-- Strom kategorií smí mít nejvýše 3 úrovně a nesmí obsahovat cyklus.
create or replace function public.categories_check_depth()
returns trigger language plpgsql set search_path = public as $$
declare
  depth integer := 1;
  p text := new.parent_id;
begin
  while p is not null loop
    depth := depth + 1;
    if p = new.id or depth > 3 then
      raise exception 'Strom kategorií smí mít nejvýše 3 úrovně a nesmí tvořit cyklus (kategorie %).', new.id;
    end if;
    select parent_id into p from public.categories where id = p;
  end loop;
  return new;
end $$;

drop trigger if exists categories_depth on public.categories;
create trigger categories_depth before insert or update on public.categories
  for each row execute function public.categories_check_depth();

-- Po registraci (Supabase Auth) vznikne záznam v profiles: id = auth.uid(), role, display_name.
-- Role a jméno se berou z metadat zadaných při registraci; cokoli jiného než client/craftsman = client.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r text := coalesce(new.raw_user_meta_data ->> 'role', 'client');
begin
  if r not in ('client', 'craftsman') then r := 'client'; end if;
  insert into public.profiles (id, role, display_name)
  values (
    new.id, r,
    left(coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1)), 60)
  )
  on conflict (id) do nothing;
  return new;
end $$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 3) Row Level Security – zapnuto všude
-- ---------------------------------------------------------------------------
alter table public.profiles                enable row level security;
alter table public.categories              enable row level security;
alter table public.craftsmen               enable row level security;
alter table public.craftsman_contacts      enable row level security;
alter table public.craftsman_categories    enable row level security;
alter table public.price_guides            enable row level security;
alter table public.availability_rules      enable row level security;
alter table public.availability_exceptions enable row level security;
alter table public.favorites               enable row level security;

-- Pomocná podmínka „řemeslník patří přihlášenému uživateli“ je v každé politice
-- zapsaná přímo (select auth.uid() se vyhodnotí jednou za dotaz).

-- ---- profiles: každý vidí a mění jen svůj profil ----
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated
  using (id = (select auth.uid()));
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ---- categories, price_guides: veřejné čtení, zápis jen přes SQL editor / service role ----
drop policy if exists categories_read on public.categories;
create policy categories_read on public.categories for select to anon, authenticated using (true);
drop policy if exists price_guides_read on public.price_guides;
create policy price_guides_read on public.price_guides for select to anon, authenticated using (true);

-- ---- craftsmen: veřejné čtení, zápis jen vlastního (ne demo) řádku ----
drop policy if exists craftsmen_read on public.craftsmen;
create policy craftsmen_read on public.craftsmen for select to anon, authenticated using (true);
drop policy if exists craftsmen_insert_own on public.craftsmen;
create policy craftsmen_insert_own on public.craftsmen for insert to authenticated
  with check (
    user_id = (select auth.uid()) and not is_demo
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'craftsman')
  );
drop policy if exists craftsmen_update_own on public.craftsmen;
create policy craftsmen_update_own on public.craftsmen for update to authenticated
  using (user_id = (select auth.uid()) and not is_demo)
  with check (user_id = (select auth.uid()) and not is_demo);
drop policy if exists craftsmen_delete_own on public.craftsmen;
create policy craftsmen_delete_own on public.craftsmen for delete to authenticated
  using (user_id = (select auth.uid()) and not is_demo);

-- ---- craftsman_contacts: anonym čte jen kontakty demo řemeslníků, přihlášený i svůj ----
-- (politika pro anon nesmí sahat na sloupec user_id – ten anonym číst nemůže)
drop policy if exists contacts_read on public.craftsman_contacts;
drop policy if exists contacts_read_anon on public.craftsman_contacts;
create policy contacts_read_anon on public.craftsman_contacts for select to anon
  using (exists (select 1 from public.craftsmen c where c.id = craftsman_id and c.is_demo));
drop policy if exists contacts_read_auth on public.craftsman_contacts;
create policy contacts_read_auth on public.craftsman_contacts for select to authenticated
  using (exists (
    select 1 from public.craftsmen c
    where c.id = craftsman_id and (c.is_demo or c.user_id = (select auth.uid()))
  ));
drop policy if exists contacts_write_own on public.craftsman_contacts;
create policy contacts_write_own on public.craftsman_contacts for all to authenticated
  using (exists (select 1 from public.craftsmen c where c.id = craftsman_id and c.user_id = (select auth.uid()) and not c.is_demo))
  with check (exists (select 1 from public.craftsmen c where c.id = craftsman_id and c.user_id = (select auth.uid()) and not c.is_demo));

-- ---- craftsman_categories, availability_*: veřejné čtení, zápis jen vlastník ----
drop policy if exists craftsman_categories_read on public.craftsman_categories;
create policy craftsman_categories_read on public.craftsman_categories for select to anon, authenticated using (true);
drop policy if exists craftsman_categories_write_own on public.craftsman_categories;
create policy craftsman_categories_write_own on public.craftsman_categories for all to authenticated
  using (exists (select 1 from public.craftsmen c where c.id = craftsman_id and c.user_id = (select auth.uid()) and not c.is_demo))
  with check (exists (select 1 from public.craftsmen c where c.id = craftsman_id and c.user_id = (select auth.uid()) and not c.is_demo));

drop policy if exists availability_rules_read on public.availability_rules;
create policy availability_rules_read on public.availability_rules for select to anon, authenticated using (true);
drop policy if exists availability_rules_write_own on public.availability_rules;
create policy availability_rules_write_own on public.availability_rules for all to authenticated
  using (exists (select 1 from public.craftsmen c where c.id = craftsman_id and c.user_id = (select auth.uid()) and not c.is_demo))
  with check (exists (select 1 from public.craftsmen c where c.id = craftsman_id and c.user_id = (select auth.uid()) and not c.is_demo));

drop policy if exists availability_exceptions_read on public.availability_exceptions;
create policy availability_exceptions_read on public.availability_exceptions for select to anon, authenticated using (true);
drop policy if exists availability_exceptions_write_own on public.availability_exceptions;
create policy availability_exceptions_write_own on public.availability_exceptions for all to authenticated
  using (exists (select 1 from public.craftsmen c where c.id = craftsman_id and c.user_id = (select auth.uid()) and not c.is_demo))
  with check (exists (select 1 from public.craftsmen c where c.id = craftsman_id and c.user_id = (select auth.uid()) and not c.is_demo));

-- ---- favorites: jen vlastní ----
drop policy if exists favorites_select_own on public.favorites;
create policy favorites_select_own on public.favorites for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists favorites_insert_own on public.favorites;
create policy favorites_insert_own on public.favorites for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists favorites_delete_own on public.favorites;
create policy favorites_delete_own on public.favorites for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 4) Oprávnění na úrovni sloupců (druhá vrstva ochrany vedle RLS)
--    Nejdřív odebereme výchozí oprávnění Supabase, pak přidáme jen potřebná.
-- ---------------------------------------------------------------------------
revoke all on public.profiles, public.categories, public.craftsmen, public.craftsman_contacts,
              public.craftsman_categories, public.price_guides, public.availability_rules,
              public.availability_exceptions, public.favorites
  from anon, authenticated;

-- veřejné čtení
grant select on public.categories, public.price_guides, public.craftsman_categories,
                public.availability_rules, public.availability_exceptions, public.craftsman_contacts
  to anon, authenticated;
-- craftsmen: anonym nevidí user_id; přihlášený ano (pozná tím svůj profil)
grant select (id, is_demo, name, role_title, town, lat, lng, description, hourly_rate, verified, rating, review_count, sample_review, created_at)
  on public.craftsmen to anon;
grant select (id, user_id, is_demo, name, role_title, town, lat, lng, description, hourly_rate, verified, rating, review_count, sample_review, created_at)
  on public.craftsmen to authenticated;
-- řemeslník nemůže sám nastavit verified, rating, review_count ani is_demo
grant insert (user_id, name, role_title, town, lat, lng, description, hourly_rate) on public.craftsmen to authenticated;
grant update (name, role_title, town, lat, lng, description, hourly_rate) on public.craftsmen to authenticated;
grant delete on public.craftsmen to authenticated;

grant insert, update, delete on public.craftsman_contacts, public.craftsman_categories,
                                public.availability_rules, public.availability_exceptions
  to authenticated;
grant usage, select on all sequences in schema public to authenticated;

grant select (id, role, display_name, created_at) on public.profiles to authenticated;
grant insert (id, role, display_name) on public.profiles to authenticated;
grant update (role, display_name) on public.profiles to authenticated;

grant select, insert, delete on public.favorites to authenticated;
