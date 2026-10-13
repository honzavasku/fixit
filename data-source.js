/* ==========================================================================
   data-source.js – zdroj dat a přihlášení se dvěma adaptéry
   --------------------------------------------------------------------------
   Podle config.js:
     - SUPABASE_URL + SUPABASE_ANON_KEY vyplněné → adaptér `supabase`
       (supabase-js v2 z CDN s pevnou verzí a kontrolou integrity),
     - jinak (nebo při chybě načtení) → adaptér `local` (data z data.js,
       simulované přihlášení v localStorage s prefixem `fixit:`).

   Oba adaptéry mají stejné rozhraní:
     mode, passwordless
     loadAll()                      → { categories, priceGuides, craftsmen }
     auth.getUser() / onChange(cb) / signUp / signIn / signOut /
          resetPassword / updatePassword / setRole
     favorites.list(userId) / set(userId, craftsmanId, on)
     craftsman.getMine(userId) / saveMine(userId, data)

   Tvar řemeslníka v aplikaci:
     { id, userId, isDemo, name, role, town, lat, lng, description, hourlyRate,
       verified, rating, reviewCount, review, categoryIds, phone, email,
       availability: { rules: [{weekday,start,end}], exceptions: [{date,isAvailable,note}] } }
   ========================================================================== */
'use strict';

const SUPABASE_JS_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/dist/umd/supabase.js';
const SUPABASE_JS_SRI = 'sha384-BWcjm9OdFth9TbhCxZPdm+gAOUMAzQy9nmTs12ioXdCcbVnJaPMn+fMUoQCLt60R';

/** Chyba s hláškou pro uživatele (česky). */
class DataError extends Error {
  constructor(userMessage, cause) { super(userMessage); this.name = 'DataError'; this.userMessage = userMessage; this.cause = cause; }
}

function authErrorMessage(err) {
  const raw = `${err?.code || ''} ${err?.message || ''}`.toLowerCase();
  if (err instanceof DataError) return err.userMessage;
  if (raw.includes('invalid login')) return 'Nesprávný e-mail nebo heslo.';
  if (raw.includes('email not confirmed') || raw.includes('email_not_confirmed')) return 'E-mail zatím není potvrzený. Klikněte na odkaz v potvrzovacím e-mailu.';
  if (raw.includes('already registered') || raw.includes('user_already_exists')) return 'Účet s tímto e-mailem už existuje. Zkuste se přihlásit.';
  if (raw.includes('weak_password') || raw.includes('at least')) return 'Heslo je příliš slabé. Použijte alespoň 8 znaků.';
  if (raw.includes('same_password')) return 'Nové heslo musí být jiné než původní.';
  if (raw.includes('rate') && raw.includes('limit')) return 'Příliš mnoho pokusů. Zkuste to prosím za chvíli.';
  if (raw.includes('invalid') && raw.includes('email')) return 'Zadejte platnou e-mailovou adresu.';
  if (raw.includes('failed to fetch') || raw.includes('network')) return 'Nepodařilo se spojit se serverem. Zkontrolujte připojení k internetu.';
  return 'Něco se nepovedlo. Zkuste to prosím znovu.';
}

/* ==========================================================================
   Pomocné převody
   ========================================================================== */
const todayKey = () => ymd(new Date());

/** Z výjimek relativních k dnešku (data.js) udělá konkrétní data. */
function seedExceptions(list) {
  return (list || []).map((x) => {
    const d = new Date(); d.setDate(d.getDate() + x.offset);
    return { date: ymd(d), isAvailable: x.available, note: x.note || '' };
  });
}

/* ==========================================================================
   Adaptér LOCAL – data z data.js + simulované přihlášení
   ========================================================================== */
function createLocalAdapter() {
  const USERS_KEY = 'local:users';
  const SESSION_KEY = 'local:session';
  const listeners = new Set();

  const users = () => storage.getJson(USERS_KEY, []);
  const sessionUser = () => {
    const id = storage.get(SESSION_KEY);
    return id ? users().find((u) => u.id === id) || null : null;
  };
  const emit = (event) => { const u = sessionUser(); listeners.forEach((cb) => cb(event, u)); };
  const publicUser = (u) => (u ? { id: u.id, email: u.email, displayName: u.displayName, role: u.role } : null);

  const ownKey = (userId) => `local:craftsman:${userId}`;

  return {
    mode: 'local',
    passwordless: true,

    async loadAll() {
      const craftsmen = CRAFTSMEN_SEED.map((c) => ({
        id: c.id, userId: null, isDemo: true, name: c.name, role: c.role, town: c.town, lat: c.lat, lng: c.lng,
        description: c.description, hourlyRate: null, verified: c.verified, rating: c.rating, reviewCount: c.reviewCount,
        review: c.review, categoryIds: [...c.categoryIds], phone: c.phone, email: c.email,
        availability: { rules: c.rules.map((r) => ({ ...r })), exceptions: seedExceptions(c.exceptions) },
      }));
      // vlastní profil přihlášeného řemeslníka (uložený lokálně) se přidá do hledání
      users().forEach((u) => {
        const mine = storage.getJson(ownKey(u.id));
        if (mine) craftsmen.push(mine);
      });
      return { categories: CATEGORIES.map((c) => ({ ...c })), priceGuides: PRICE_GUIDES.map((g) => ({ ...g })), craftsmen };
    },

    auth: {
      async getUser() { return publicUser(sessionUser()); },
      onChange(cb) { listeners.add(cb); return () => listeners.delete(cb); },
      async signUp({ email, displayName, role }) {
        const mail = String(email).trim().toLowerCase();
        if (users().some((u) => u.email === mail)) throw new DataError('Účet s tímto e-mailem už existuje. Zkuste se přihlásit.');
        const user = { id: 'local-' + Date.now().toString(36), email: mail, displayName: displayName || mail.split('@')[0], role };
        storage.setJson(USERS_KEY, [...users(), user]);
        storage.set(SESSION_KEY, user.id);
        emit('SIGNED_IN');
        return { user: publicUser(user), needsConfirmation: false };
      },
      async signIn({ email }) {
        const mail = String(email).trim().toLowerCase();
        const user = users().find((u) => u.email === mail);
        if (!user) throw new DataError('Účet s tímto e-mailem v demo režimu neexistuje. Nejdřív se zaregistrujte.');
        storage.set(SESSION_KEY, user.id);
        emit('SIGNED_IN');
        return { user: publicUser(user) };
      },
      async signOut() { storage.remove(SESSION_KEY); emit('SIGNED_OUT'); },
      async resetPassword() { throw new DataError('V demo režimu žádné heslo neexistuje, obnova hesla není potřeba.'); },
      async updatePassword() { throw new DataError('V demo režimu žádné heslo neexistuje.'); },
      async setRole(userId, role) {
        storage.setJson(USERS_KEY, users().map((u) => (u.id === userId ? { ...u, role } : u)));
        emit('USER_UPDATED');
      },
    },

    favorites: {
      async list(userId) { return new Set(storage.getJson(`local:favorites:${userId}`, [])); },
      async set(userId, craftsmanId, on) {
        const s = new Set(storage.getJson(`local:favorites:${userId}`, []));
        if (on) s.add(craftsmanId); else s.delete(craftsmanId);
        storage.setJson(`local:favorites:${userId}`, [...s]);
      },
    },

    craftsman: {
      async getMine(userId) { return storage.getJson(ownKey(userId)); },
      async saveMine(userId, data) {
        const prev = storage.getJson(ownKey(userId));
        const mine = {
          id: prev?.id || 'me-' + userId, userId, isDemo: false, verified: false, rating: null, reviewCount: 0, review: null,
          availability: { rules: [], exceptions: [] },
          ...prev, ...data,
        };
        storage.setJson(ownKey(userId), mine);
        return mine;
      },
    },
  };
}

/* ==========================================================================
   Adaptér SUPABASE
   ========================================================================== */
function createSupabaseAdapter(url, anonKey) {
  const sb = window.supabase.createClient(url, anonKey, {
    auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'fixit:auth' },
  });
  const redirectTo = location.origin + location.pathname;

  // explicitní sloupce (anonymní role nemá právo číst všechny, např. user_id)
  const CRAFTSMAN_COLS = 'id,is_demo,name,role_title,town,lat,lng,description,hourly_rate,verified,rating,review_count,sample_review';
  const CRAFTSMAN_COLS_AUTH = CRAFTSMAN_COLS + ',user_id';
  const EMBEDS = 'craftsman_categories(category_id),availability_rules(weekday,start_time,end_time),' +
    'availability_exceptions(date,is_available,note),craftsman_contacts(phone,email)';

  const hm = (t) => String(t).slice(0, 5);

  function fromRow(r) {
    const contact = Array.isArray(r.craftsman_contacts) ? r.craftsman_contacts[0] : r.craftsman_contacts;
    const today = todayKey();
    return {
      id: r.id, userId: r.user_id || null, isDemo: !!r.is_demo, name: r.name, role: r.role_title, town: r.town,
      lat: Number(r.lat), lng: Number(r.lng), description: r.description || '',
      hourlyRate: r.hourly_rate ?? null, verified: !!r.verified,
      rating: r.rating != null ? Number(r.rating) : null, reviewCount: r.review_count || 0, review: r.sample_review || null,
      categoryIds: (r.craftsman_categories || []).map((x) => x.category_id),
      phone: contact?.phone || '', email: contact?.email || '',
      availability: {
        rules: (r.availability_rules || []).map((x) => ({ weekday: x.weekday, start: hm(x.start_time), end: hm(x.end_time) })),
        exceptions: (r.availability_exceptions || []).filter((x) => x.date >= today)
          .map((x) => ({ date: x.date, isAvailable: x.is_available, note: x.note || '' })),
      },
    };
  }

  const check = ({ data, error }, what) => {
    if (error) throw new DataError(`${what} se nepodařilo (${error.message || 'chyba serveru'}).`, error);
    return data;
  };

  async function getUser() {
    const { data } = await sb.auth.getSession();
    const session = data?.session;
    if (!session) return null;
    const u = session.user;
    let { data: profile } = await sb.from('profiles').select('id,role,display_name').eq('id', u.id).maybeSingle();
    if (!profile) {
      // účet bez profilu (např. vytvořený před spuštěním triggeru) – zkusíme profil doplnit
      const role = u.user_metadata?.role === 'craftsman' ? 'craftsman' : 'client';
      const display_name = u.user_metadata?.display_name || (u.email || '').split('@')[0];
      const res = await sb.from('profiles').insert({ id: u.id, role, display_name }).select('id,role,display_name').maybeSingle();
      profile = res.data || { id: u.id, role, display_name };
    }
    return { id: u.id, email: u.email, displayName: profile.display_name, role: profile.role };
  }

  return {
    mode: 'supabase',
    passwordless: false,

    async loadAll() {
      const [cats, prices, crafts] = await Promise.all([
        sb.from('categories').select('id,parent_id,name,slug,icon,keywords,sort_order').order('sort_order'),
        sb.from('price_guides').select('*'),
        sb.from('craftsmen').select(`${CRAFTSMAN_COLS},${EMBEDS}`),
      ]);
      return {
        categories: check(cats, 'Načtení kategorií'),
        priceGuides: check(prices, 'Načtení ceníku'),
        craftsmen: check(crafts, 'Načtení řemeslníků').map(fromRow),
      };
    },

    auth: {
      getUser,
      onChange(cb) {
        const { data } = sb.auth.onAuthStateChange((event) => {
          // uvnitř callbacku nevoláme další dotazy přímo (doporučení supabase-js)
          setTimeout(async () => { cb(event, event === 'SIGNED_OUT' ? null : await getUser().catch(() => null)); }, 0);
        });
        return () => data.subscription.unsubscribe();
      },
      async signUp({ email, password, displayName, role }) {
        const { data, error } = await sb.auth.signUp({
          email: String(email).trim(), password,
          options: { data: { role, display_name: displayName }, emailRedirectTo: redirectTo },
        });
        if (error) throw error;
        // při zapnutém potvrzování e-mailu a již existujícím účtu vrací Supabase prázdné identities
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          throw new DataError('Účet s tímto e-mailem už existuje. Zkuste se přihlásit.');
        }
        return { user: data.session ? await getUser() : null, needsConfirmation: !data.session };
      },
      async signIn({ email, password }) {
        const { error } = await sb.auth.signInWithPassword({ email: String(email).trim(), password });
        if (error) throw error;
        return { user: await getUser() };
      },
      async signOut() { const { error } = await sb.auth.signOut(); if (error) throw error; },
      async resetPassword(email) {
        const { error } = await sb.auth.resetPasswordForEmail(String(email).trim(), { redirectTo });
        if (error) throw error;
      },
      async updatePassword(password) {
        const { error } = await sb.auth.updateUser({ password });
        if (error) throw error;
      },
      async setRole(userId, role) {
        check(await sb.from('profiles').update({ role }).eq('id', userId), 'Změna role');
      },
    },

    favorites: {
      async list(userId) {
        const rows = check(await sb.from('favorites').select('craftsman_id').eq('user_id', userId), 'Načtení oblíbených');
        return new Set(rows.map((r) => r.craftsman_id));
      },
      async set(userId, craftsmanId, on) {
        if (on) check(await sb.from('favorites').upsert({ user_id: userId, craftsman_id: craftsmanId }, { onConflict: 'user_id,craftsman_id', ignoreDuplicates: true }), 'Uložení oblíbeného');
        else check(await sb.from('favorites').delete().eq('user_id', userId).eq('craftsman_id', craftsmanId), 'Odebrání oblíbeného');
      },
    },

    craftsman: {
      async getMine(userId) {
        const row = check(await sb.from('craftsmen').select(`${CRAFTSMAN_COLS_AUTH},${EMBEDS}`).eq('user_id', userId).maybeSingle(), 'Načtení profilu');
        return row ? fromRow(row) : null;
      },
      async saveMine(userId, d) {
        const base = {
          name: d.name, role_title: d.role, town: d.town, lat: d.lat, lng: d.lng,
          description: d.description, hourly_rate: d.hourlyRate,
        };
        const existing = check(await sb.from('craftsmen').select('id').eq('user_id', userId).maybeSingle(), 'Načtení profilu');
        let id = existing?.id;
        if (id) {
          check(await sb.from('craftsmen').update(base).eq('id', id), 'Uložení profilu');
        } else {
          const row = check(await sb.from('craftsmen').insert({ ...base, user_id: userId }).select('id').single(), 'Vytvoření profilu');
          id = row.id;
        }

        // obory, kontakty, dostupnost: nahradíme celé sady (jednoduché; prototyp)
        check(await sb.from('craftsman_categories').delete().eq('craftsman_id', id), 'Uložení oborů');
        if (d.categoryIds?.length) {
          check(await sb.from('craftsman_categories').insert(d.categoryIds.map((category_id) => ({ craftsman_id: id, category_id }))), 'Uložení oborů');
        }
        check(await sb.from('craftsman_contacts').upsert({ craftsman_id: id, phone: d.phone || null, email: d.email || null }), 'Uložení kontaktu');
        if (d.availability) {
          check(await sb.from('availability_rules').delete().eq('craftsman_id', id), 'Uložení dostupnosti');
          if (d.availability.rules.length) {
            check(await sb.from('availability_rules').insert(d.availability.rules.map((r) => ({
              craftsman_id: id, weekday: r.weekday, start_time: r.start, end_time: r.end,
            }))), 'Uložení dostupnosti');
          }
          check(await sb.from('availability_exceptions').delete().eq('craftsman_id', id), 'Uložení výjimek');
          if (d.availability.exceptions.length) {
            check(await sb.from('availability_exceptions').insert(d.availability.exceptions.map((x) => ({
              craftsman_id: id, date: x.date, is_available: x.isAvailable, note: x.note || null,
            }))), 'Uložení výjimek');
          }
        }
        const saved = check(await sb.from('craftsmen').select(`${CRAFTSMAN_COLS_AUTH},${EMBEDS}`).eq('id', id).single(), 'Načtení profilu');
        return fromRow(saved);
      },
    },
  };
}

/* ==========================================================================
   Volba adaptéru
   ========================================================================== */

/** Odmítne tajný klíč omylem vložený do config.js (service_role / sb_secret_). */
function assertPublicKey(key) {
  if (/^sb_secret_/i.test(key)) throw new Error('V config.js je TAJNÝ klíč (sb_secret_…). Do prohlížeče patří jen veřejný anon klíč.');
  const parts = key.split('.');
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (payload.role === 'service_role') throw new Error('V config.js je klíč service_role! Okamžitě ho odstraňte a v Supabase ho vygenerujte znovu.');
    } catch (e) {
      if (e.message && e.message.includes('service_role')) throw e;
    }
  }
}

/**
 * Vybere adaptér a načte data. Vrací { ds, data, notice } – `notice` je hláška,
 * pokud se muselo přejít na záložní (lokální) režim.
 */
async function initDataSource() {
  const url = String(CFG.SUPABASE_URL || '').trim();
  const key = String(CFG.SUPABASE_ANON_KEY || '').trim();
  let notice = '';

  if (url && key) {
    try {
      assertPublicKey(key);
      if (!window.supabase) await loadScript(SUPABASE_JS_URL, SUPABASE_JS_SRI);
      const ds = createSupabaseAdapter(url, key);
      const data = await ds.loadAll();
      if (!data.categories.length) throw new Error('Databáze je prázdná (spusťte supabase/seed.sql).');
      return { ds, data, notice };
    } catch (e) {
      console.error('Supabase není dostupná, přepínám na lokální data:', e);
      notice = e?.message && /TAJNÝ|service_role/.test(e.message)
        ? e.message
        : 'Databázi se nepodařilo načíst, běží záložní režim s lokálními daty.';
    }
  }
  const ds = createLocalAdapter();
  return { ds, data: await ds.loadAll(), notice };
}
