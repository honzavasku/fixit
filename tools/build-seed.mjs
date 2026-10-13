#!/usr/bin/env node
/* ==========================================================================
   tools/build-seed.mjs – vygeneruje supabase/seed.sql z data.js
   Spuštění (z kořene projektu):  node tools/build-seed.mjs
   data.js je jediný zdroj pravdy; seed.sql needituj ručně, přegeneruj ho.
   ========================================================================== */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const code = readFileSync(join(root, 'data.js'), 'utf8');
const { CATEGORIES, PRICE_GUIDES, CRAFTSMEN_SEED } = vm.runInNewContext(
  `${code}\n({ CATEGORIES, PRICE_GUIDES, CRAFTSMEN_SEED })`, {}, { filename: 'data.js' },
);

/* ---- SQL literály ---- */
const str = (v) => (v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const num = (v) => (v == null ? 'null' : String(Number(v)));
const arr = (a) => `array[${a.map(str).join(', ')}]::text[]`;
const uuid = (id) => `'00000000-0000-4000-8000-${'0'.repeat(10)}${id.replace(/\D/g, '').padStart(2, '0')}'`;

const depth = (c) => { let d = 1; for (let p = c.parent_id; p; p = CATEGORIES.find((x) => x.id === p).parent_id) d++; return d; };

const out = [];
out.push(`-- ============================================================================
-- FixIt – ukázková data (seed). VYGENEROVÁNO: node tools/build-seed.mjs (z data.js).
-- Needituj ručně. Spusť ručně v Supabase SQL editoru PO supabase/schema.sql.
-- Skript je opakovatelný: aktualizuje kategorie, ceník a demo řemeslníky.
--
-- !! Všichni řemeslníci jsou SMYŠLENÍ (user_id = null, is_demo = true), telefony
-- !! +420 777 000 1xx, e-maily na example.cz. Přes API se změnit nedají.
-- !! Ceny v price_guides jsou ILUSTRATIVNÍ.
-- ============================================================================

begin;
`);

/* kategorie po úrovních (rodič vždy dřív než dítě) */
out.push('-- Kategorie (strom o max. 3 úrovních)');
for (const d of [1, 2, 3]) {
  const rows = CATEGORIES.filter((c) => depth(c) === d);
  if (!rows.length) continue;
  out.push(`insert into public.categories (id, parent_id, name, slug, icon, keywords, sort_order) values`);
  out.push(rows.map((c) => `  (${str(c.id)}, ${str(c.parent_id)}, ${str(c.name)}, ${str(c.slug)}, ${str(c.icon)}, ${arr(c.keywords)}, ${num(c.sort_order)})`).join(',\n'));
  out.push(`on conflict (id) do update set parent_id = excluded.parent_id, name = excluded.name, slug = excluded.slug,
  icon = excluded.icon, keywords = excluded.keywords, sort_order = excluded.sort_order;\n`);
}

/* ceník */
out.push('-- Orientační ceny (ilustrativní)');
out.push(`insert into public.price_guides (category_id, unit, min_czk, max_czk, callout_min_czk, callout_max_czk,
  typical_hours_min, typical_hours_max, emergency_surcharge_pct_min, emergency_surcharge_pct_max, note, source, is_illustrative) values`);
out.push(PRICE_GUIDES.map((g) => `  (${str(g.category_id)}, ${str(g.unit)}, ${num(g.min_czk)}, ${num(g.max_czk)}, ${num(g.callout_min_czk)}, ${num(g.callout_max_czk)}, ${num(g.typical_hours_min)}, ${num(g.typical_hours_max)}, ${num(g.emergency_surcharge_pct_min)}, ${num(g.emergency_surcharge_pct_max)}, ${str(g.note)}, ${str(g.source)}, true)`).join(',\n'));
out.push(`on conflict (category_id, unit) do update set min_czk = excluded.min_czk, max_czk = excluded.max_czk,
  callout_min_czk = excluded.callout_min_czk, callout_max_czk = excluded.callout_max_czk,
  typical_hours_min = excluded.typical_hours_min, typical_hours_max = excluded.typical_hours_max,
  emergency_surcharge_pct_min = excluded.emergency_surcharge_pct_min, emergency_surcharge_pct_max = excluded.emergency_surcharge_pct_max,
  note = excluded.note, source = excluded.source, is_illustrative = excluded.is_illustrative;\n`);

/* demo řemeslníci */
out.push('-- Demo řemeslníci (smyšlení, user_id = null)');
out.push(`insert into public.craftsmen (id, user_id, is_demo, name, role_title, town, lat, lng, description, hourly_rate, verified, rating, review_count, sample_review) values`);
out.push(CRAFTSMEN_SEED.map((c) => `  (${uuid(c.id)}, null, true, ${str(c.name)}, ${str(c.role)}, ${str(c.town)}, ${num(c.lat)}, ${num(c.lng)}, ${str(c.description)}, null, ${c.verified}, ${num(c.rating)}, ${num(c.reviewCount)}, ${str(JSON.stringify(c.review))}::jsonb)`).join(',\n'));
out.push(`on conflict (id) do update set name = excluded.name, role_title = excluded.role_title, town = excluded.town,
  lat = excluded.lat, lng = excluded.lng, description = excluded.description, verified = excluded.verified,
  rating = excluded.rating, review_count = excluded.review_count, sample_review = excluded.sample_review
  where public.craftsmen.is_demo;\n`);

const demoIds = CRAFTSMEN_SEED.map((c) => uuid(c.id)).join(', ');

out.push('-- Kontakty demo řemeslníků (smyšlené)');
out.push(`insert into public.craftsman_contacts (craftsman_id, phone, email) values`);
out.push(CRAFTSMEN_SEED.map((c) => `  (${uuid(c.id)}, ${str(c.phone)}, ${str(c.email)})`).join(',\n'));
out.push(`on conflict (craftsman_id) do update set phone = excluded.phone, email = excluded.email;\n`);

out.push('-- Obory demo řemeslníků');
out.push(`delete from public.craftsman_categories where craftsman_id in (${demoIds});`);
out.push(`insert into public.craftsman_categories (craftsman_id, category_id) values`);
out.push(CRAFTSMEN_SEED.flatMap((c) => c.categoryIds.map((cat) => `  (${uuid(c.id)}, ${str(cat)})`)).join(',\n') + ';\n');

out.push('-- Týdenní dostupnost (weekday 1 = pondělí … 7 = neděle)');
out.push(`delete from public.availability_rules where craftsman_id in (${demoIds});`);
out.push(`insert into public.availability_rules (craftsman_id, weekday, start_time, end_time) values`);
out.push(CRAFTSMEN_SEED.flatMap((c) => c.rules.map((r) => `  (${uuid(c.id)}, ${r.weekday}, ${str(r.start)}, ${str(r.end)})`)).join(',\n') + ';\n');

out.push('-- Výjimky (relativně k datu spuštění seedu; is_available = false → nepracuje)');
out.push(`delete from public.availability_exceptions where craftsman_id in (${demoIds});`);
const ex = CRAFTSMEN_SEED.flatMap((c) => c.exceptions.map((x) => `  (${uuid(c.id)}, current_date + ${x.offset}, ${x.available}, ${str(x.note || null)})`));
if (ex.length) {
  out.push(`insert into public.availability_exceptions (craftsman_id, date, is_available, note) values`);
  out.push(ex.join(',\n') + ';\n');
}

out.push('commit;\n');
writeFileSync(join(root, 'supabase', 'seed.sql'), out.join('\n'));
console.log(`supabase/seed.sql: ${CATEGORIES.length} kategorií, ${PRICE_GUIDES.length} cen, ${CRAFTSMEN_SEED.length} řemeslníků`);
