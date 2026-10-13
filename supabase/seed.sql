-- ============================================================================
-- FixIt – ukázková data (seed). VYGENEROVÁNO: node tools/build-seed.mjs (z data.js).
-- Needituj ručně. Spusť ručně v Supabase SQL editoru PO supabase/schema.sql.
-- Skript je opakovatelný: aktualizuje kategorie, ceník a demo řemeslníky.
--
-- !! Všichni řemeslníci jsou SMYŠLENÍ (user_id = null, is_demo = true), telefony
-- !! +420 777 000 1xx, e-maily na example.cz. Přes API se změnit nedají.
-- !! Ceny v price_guides jsou ILUSTRATIVNÍ.
-- ============================================================================

begin;

-- Kategorie (strom o max. 3 úrovních)
insert into public.categories (id, parent_id, name, slug, icon, keywords, sort_order) values
  ('dum', null, 'Dům a byt', 'dum', 'home', array['dum ', 'domacnost', 'byt ']::text[], 10),
  ('zahrada', null, 'Zahrada', 'zahrada', 'tree', array['zahrad']::text[], 20),
  ('stavba', null, 'Stavba a rekonstrukce', 'stavba', 'brick', array['stavb', 'rekonstrukc', 'prestavb']::text[], 30),
  ('energie', null, 'Klima a energie', 'energie', 'sun', array['energi', 'uspor']::text[], 40)
on conflict (id) do update set parent_id = excluded.parent_id, name = excluded.name, slug = excluded.slug,
  icon = excluded.icon, keywords = excluded.keywords, sort_order = excluded.sort_order;

insert into public.categories (id, parent_id, name, slug, icon, keywords, sort_order) values
  ('voda', 'dum', 'Voda a odpady', 'voda', 'drop', array['voda', 'vody', 'vodu', 'vodar', 'vodovod', 'potrubi', 'zatop', 'prosakuj', 'vana', 'vane', 'sprch', 'instalat']::text[], 10),
  ('elektro', 'dum', 'Elektro', 'elektro', 'bolt', array['elektr', 'kabel', 'vodic', 'jiskr', 'nabijec']::text[], 20),
  ('topeni', 'dum', 'Topení a plyn', 'topeni', 'flame', array['topeni', 'topit', 'topi ', 'termostat', 'podlahovk', 'plyn']::text[], 30),
  ('podlahy-malovani', 'dum', 'Podlahy a malování', 'podlahy-malovani', 'paint', array['malovani', 'malovat', 'vymalov', 'podlah', 'parket', 'lamino', 'vinyl', 'tapet', 'stena', 'steny', 'sten ', 'omitk', 'sadrokarton', 'natir', 'natre', 'strop']::text[], 40),
  ('okna-dvere', 'dum', 'Okna a dveře', 'okna-dvere', 'door', array['okn', 'dvere', 'dveri', 'parapet', 'zaluzi', 'tesneni']::text[], 50),
  ('strecha', 'dum', 'Střecha a fasáda', 'strecha', 'roof', array['strech', 'strese', 'tasky', 'tasek', 'krytin', 'fasad', 'okap', 'zateka', 'zatek', 'klempir', 'lisejnik', 'komin']::text[], 60),
  ('manzel', 'dum', 'Hodinový manžel', 'manzel', 'wrench', array['police', 'policku', 'namontov', 'montaz', 'smontov', 'nabytek', 'skrin', 'zaves', 'pripevn', 'uvolnen', 'ikea', 'kuchyn', 'drobn', 'vrzaj', 'dvirk', 'klik']::text[], 70),
  ('stromy', 'zahrada', 'Stromy', 'stromy', 'tree', array['strom', 'vetev', 'vetve']::text[], 10),
  ('travnik', 'zahrada', 'Trávník a údržba', 'travnik', 'grass', array['trav', 'sekac', 'sekat', 'sekani', 'travnik', 'kos ', 'keri', 'udrzb']::text[], 20),
  ('ploty', 'zahrada', 'Ploty', 'ploty', 'fence', array['plot ', 'plotu', 'ploty', 'plotem', 'zivy plot', 'zivopl', 'plotov']::text[], 30),
  ('terasy', 'zahrada', 'Terasy a dlažba', 'terasy', 'deck', array['teras', 'pergol', 'zamkov', 'chodnik', 'zahradni dlazb']::text[], 40),
  ('zavlazovani', 'zahrada', 'Zavlažování', 'zavlazovani', 'sprinkler', array['zavlah', 'zavlaz', 'postrik', 'kapkov', 'rozstrik', 'sprinkler']::text[], 50),
  ('zednik', 'stavba', 'Zedník', 'zednik', 'brick', array['zedn', 'zed ', 'zdit', 'vyzdit', 'beton', 'prickov', 'pretrh', 'bourani', 'bourat', 'omitk']::text[], 10),
  ('obklady', 'stavba', 'Obklady a dlažby', 'obklady', 'tiles', array['obklad', 'dlazdic', 'dlazb', 'spar', 'koupeln']::text[], 20),
  ('zatepleni', 'stavba', 'Zateplení', 'zatepleni', 'layers', array['zateplen', 'polystyren', 'izolac', 'tepelna izolac', 'fasad', 'zatepl']::text[], 30),
  ('klimatizace', 'energie', 'Klimatizace', 'klimatizace', 'snow', array['klimatizac', 'klima', 'split', 'chlazeni', 'ochlaz', 'vzduchotechnik']::text[], 10),
  ('fotovoltaika', 'energie', 'Fotovoltaika', 'fotovoltaika', 'sun', array['fotovolt', 'solarn', 'panel', 'strida', 'fve', 'akumulac']::text[], 20),
  ('tepelna-cerpadla', 'energie', 'Tepelná čerpadla', 'tepelna-cerpadla', 'heatpump', array['tepelne cerpadl', 'tepelneho cerpadl', 'cerpadl']::text[], 30)
on conflict (id) do update set parent_id = excluded.parent_id, name = excluded.name, slug = excluded.slug,
  icon = excluded.icon, keywords = excluded.keywords, sort_order = excluded.sort_order;

insert into public.categories (id, parent_id, name, slug, icon, keywords, sort_order) values
  ('kohoutky', 'voda', 'Kohoutky a baterie', 'kohoutky', 'tap', array['kohoutek', 'kohout', 'kape', 'tece', 'baterie', 'umyvadl', 'dres', 'tekouc']::text[], 10),
  ('wc', 'voda', 'WC', 'wc', 'drop', array['wc', 'zachod', 'splach', 'klozet', 'zachodov']::text[], 20),
  ('odpad', 'voda', 'Ucpaný odpad', 'odpad', 'drop', array['odpad', 'ucpan', 'ucpa', 'zacpan', 'sifon', 'kanaliz']::text[], 30),
  ('bojler', 'voda', 'Bojler', 'bojler', 'drop', array['bojler', 'ohrivac', 'zasobnik', 'ohrev vody', 'teplou vodu']::text[], 40),
  ('zasuvky', 'elektro', 'Zásuvky a vypínače', 'zasuvky', 'bolt', array['zasuvk', 'vypinac', 'zasuvce']::text[], 10),
  ('jistice', 'elektro', 'Jističe', 'jistice', 'bolt', array['jistic', 'pojistk', 'rozvadec', 'vypadl', 'vyhodil', 'zkrat', 'proud', 'elektromer']::text[], 20),
  ('osvetleni', 'elektro', 'Osvětlení', 'osvetleni', 'bolt', array['svetl', 'zarovk', 'lustr', 'svitidl', 'osvetlen']::text[], 30),
  ('kotel', 'topeni', 'Kotel', 'kotel', 'flame', array['kotel', 'kotle', 'spalin', 'plynov']::text[], 10),
  ('radiatory', 'topeni', 'Radiátory', 'radiatory', 'flame', array['radiator', 'otopn', 'studen', 'odvzdus']::text[], 20),
  ('zamecnik', 'okna-dvere', 'Zámečník a zabouchnuté dveře', 'zamecnik', 'key', array['zamek', 'zamk', 'zamyk', 'klic', 'zabouch', 'vlozk', 'zamcen', 'bezpecnostn', 'dvere', 'dveri']::text[], 10),
  ('kaceni', 'stromy', 'Kácení', 'kaceni', 'tree', array['kacet', 'kaceni', 'pokacet', 'porazit', 'padl strom', 'spadl strom']::text[], 10),
  ('prorez', 'stromy', 'Prořez', 'prorez', 'tree', array['orez', 'prorez', 'tuje', 'tuji', 'zkratit vetv']::text[], 20)
on conflict (id) do update set parent_id = excluded.parent_id, name = excluded.name, slug = excluded.slug,
  icon = excluded.icon, keywords = excluded.keywords, sort_order = excluded.sort_order;

-- Orientační ceny (ilustrativní)
insert into public.price_guides (category_id, unit, min_czk, max_czk, callout_min_czk, callout_max_czk,
  typical_hours_min, typical_hours_max, emergency_surcharge_pct_min, emergency_surcharge_pct_max, note, source, is_illustrative) values
  ('voda', 'h', 500, 1200, null, null, null, null, 50, 100, 'Sazba instalatéra.', 'Ilustrativní údaj pro školní projekt. Orientační ceny z let 2024–2026, převážně pražské; v okrese bývají nižší. Není to nabídka ani ceník.', true),
  ('bojler', 'ks', 1000, null, null, null, null, null, null, null, 'Cena za demontáž bojleru. Montáž nového bojleru a materiál se účtují zvlášť.', 'Ilustrativní údaj pro školní projekt. Orientační ceny z let 2024–2026, převážně pražské; v okrese bývají nižší. Není to nabídka ani ceník.', true),
  ('elektro', 'h', 300, 900, null, null, null, null, null, null, 'Sazba elektrikáře.', 'Ilustrativní údaj pro školní projekt. Orientační ceny z let 2024–2026, převážně pražské; v okrese bývají nižší. Není to nabídka ani ceník.', true),
  ('manzel', 'h', 250, 450, null, null, null, null, null, null, 'Sazba hodinového manžela za drobné opravy a montáže.', 'Ilustrativní údaj pro školní projekt. Orientační ceny z let 2024–2026, převážně pražské; v okrese bývají nižší. Není to nabídka ani ceník.', true),
  ('podlahy-malovani', 'h', 350, null, null, null, null, null, null, null, 'Zhruba tato sazba za hodinu práce malíře; materiál zvlášť.', 'Ilustrativní údaj pro školní projekt. Orientační ceny z let 2024–2026, převážně pražské; v okrese bývají nižší. Není to nabídka ani ceník.', true),
  ('zatepleni', 'm2', 500, null, null, null, null, null, null, null, 'Zateplení polystyrenem, cena za m² od zhruba této částky.', 'Ilustrativní údaj pro školní projekt. Orientační ceny z let 2024–2026, převážně pražské; v okrese bývají nižší. Není to nabídka ani ceník.', true)
on conflict (category_id, unit) do update set min_czk = excluded.min_czk, max_czk = excluded.max_czk,
  callout_min_czk = excluded.callout_min_czk, callout_max_czk = excluded.callout_max_czk,
  typical_hours_min = excluded.typical_hours_min, typical_hours_max = excluded.typical_hours_max,
  emergency_surcharge_pct_min = excluded.emergency_surcharge_pct_min, emergency_surcharge_pct_max = excluded.emergency_surcharge_pct_max,
  note = excluded.note, source = excluded.source, is_illustrative = excluded.is_illustrative;

-- Demo řemeslníci (smyšlení, user_id = null)
insert into public.craftsmen (id, user_id, is_demo, name, role_title, town, lat, lng, description, hourly_rate, verified, rating, review_count, sample_review) values
  ('00000000-0000-4000-8000-000000000001', null, true, 'Pavel K.', 'Instalatér', 'Rakovník', 50.1062, 13.7385, 'Opravy kohoutků, sifonů a baterií, čištění odpadů, výměna WC. Do hodiny od zavolání vím, jak velká oprava to bude.', null, true, 4.8, 37, '{"author":"Jitka M.","stars":5,"text":"Přijel druhý den ráno, kohoutek opravil za půl hodiny a uklidil po sobě."}'::jsonb),
  ('00000000-0000-4000-8000-000000000002', null, true, 'Tomáš R.', 'Instalatér', 'Tuchlovice', 50.1405, 13.9852, 'Rodinné domy i byty: rozvody vody, bojlery, ucpané odpady. Pracuji i o víkendech po domluvě.', null, false, 4.6, 21, '{"author":"Marek L.","stars":4,"text":"Poctivá práce a férová cena, jen jsem čekal o den déle, než slíbil."}'::jsonb),
  ('00000000-0000-4000-8000-000000000003', null, true, 'Jana S.', 'Instalatérka', 'Kladno', 50.1511, 14.095, 'Havárie vody, vodoměry, rekonstrukce koupelen. Vždy předem řeknu orientační cenu.', null, true, 4.9, 54, '{"author":"Petra V.","stars":5,"text":"Prasklá hadička pod dřezem, přijela ještě ten den a vše vyřešila."}'::jsonb),
  ('00000000-0000-4000-8000-000000000004', null, true, 'Martin V.', 'Elektrikář', 'Rakovník', 50.0998, 13.7292, 'Opravy zásuvek, jističů a rozvaděčů, výměna osvětlení, revize elektroinstalace v bytech i domech.', null, true, 4.7, 42, '{"author":"Hana B.","stars":5,"text":"Našel příčinu, proč mi stále vypadával jistič. Vše vysvětlil srozumitelně."}'::jsonb),
  ('00000000-0000-4000-8000-000000000005', null, true, 'Lukáš H.', 'Elektrikář', 'Nové Strašecí', 50.158, 13.9061, 'Elektroinstalace v novostavbách i rekonstrukcích, chytré vypínače, nabíjecí stanice pro auta.', null, false, 4.5, 18, '{"author":"Roman T.","stars":4,"text":"Dobrá práce, jen komunikace e-mailem trvala déle."}'::jsonb),
  ('00000000-0000-4000-8000-000000000006', null, true, 'Ondřej B.', 'Elektrikář', 'Kladno', 50.1389, 14.1124, 'Hledání poruch, výpadky proudu, opravy po zkratu. Mám revizní oprávnění pro běžné domácnosti.', null, true, 4.9, 63, '{"author":"Alena P.","stars":5,"text":"Přijel večer, nejde světlo vyřešil za deset minut. Doporučuji."}'::jsonb),
  ('00000000-0000-4000-8000-000000000007', null, true, 'Karel D.', 'Topenář a plynař', 'Slaný', 50.2268, 14.0801, 'Servis plynových kotlů, výměna radiátorů, odvzdušnění a vyvážení topné soustavy před sezónou.', null, true, 4.4, 29, '{"author":"Eliška K.","stars":4,"text":"Kotel po servisu běží tišeji. Termín jsme museli trochu posunout."}'::jsonb),
  ('00000000-0000-4000-8000-000000000008', null, true, 'Radek M.', 'Topenář', 'Rakovník', 50.1109, 13.7248, 'Radiátory, podlahové topení, výměna oběhových čerpadel a termostatů. Servis i o víkendu.', null, true, 4.8, 33, '{"author":"Ivo Č.","stars":5,"text":"Radiátor v obýváku byl studený, během hodiny topil jako nový."}'::jsonb),
  ('00000000-0000-4000-8000-000000000009', null, true, 'Michal T.', 'Hodinový manžel', 'Tuchlovice', 50.1349, 13.9967, 'Montáž nábytku a polic, drobné opravy v domácnosti, výměna klik, těsnění oken a dveří.', null, false, 4.6, 47, '{"author":"Lenka F.","stars":5,"text":"Za jedno odpoledne zvládl smontovat skříň, pověsit police i opravit dvířka."}'::jsonb),
  ('00000000-0000-4000-8000-000000000010', null, true, 'Petr Z.', 'Hodinový manžel', 'Kladno', 50.1442, 14.1198, 'Drobné zednické a truhlářské práce, montáž kuchyní, opravy po bytových revitalizacích.', null, false, 4.3, 15, '{"author":"Zuzana D.","stars":4,"text":"Solidní práce, ceny odpovídají. Příště bych uvítala dřívější potvrzení termínu."}'::jsonb),
  ('00000000-0000-4000-8000-000000000011', null, true, 'Eva N.', 'Malířka', 'Rakovník', 50.1015, 13.7421, 'Malování bytů a domů, štukování, tapetování. Pracuji čistě, nábytek přikrývám a po práci uklízím.', null, true, 4.9, 26, '{"author":"Tereza H.","stars":5,"text":"Vymalovaný byt 3+1 za dva dny, žádná skvrna, krásně rovné hrany."}'::jsonb),
  ('00000000-0000-4000-8000-000000000012', null, true, 'Josef L.', 'Malíř a podlahář', 'Stochov', 50.1495, 13.9591, 'Pokládka plovoucích podlah a vinylu, broušení parket, malování stropů a stěn.', null, false, 4.5, 31, '{"author":"Michaela S.","stars":4,"text":"Podlaha v obýváku vypadá skvěle. Trochu se protáhla dodávka materiálu."}'::jsonb),
  ('00000000-0000-4000-8000-000000000013', null, true, 'Vojtěch P.', 'Pokrývač', 'Křivoklát', 50.0402, 13.8741, 'Opravy střech a komínů, výměna tašek, oplechování, zatékání do střešního pláště.', null, true, 4.7, 19, '{"author":"Dagmar R.","stars":5,"text":"Zatékání po bouři opravil provizorně ještě týž den, pak přijel na pořádnou opravu."}'::jsonb),
  ('00000000-0000-4000-8000-000000000014', null, true, 'Radim Š.', 'Pokrývač a klempíř', 'Rakovník', 50.0965, 13.7358, 'Okapy, svody, klempířské prvky, nátěry střech a fasády. Pracuji s lešením i lanem.', null, false, 4.4, 12, '{"author":"Václav O.","stars":4,"text":"Okapy vyměnil rychle a čistě. Cena byla trochu vyšší, než jsem čekal."}'::jsonb),
  ('00000000-0000-4000-8000-000000000015', null, true, 'Zdeněk F.', 'Zahradník', 'Lány', 50.1269, 13.9502, 'Řez a kácení stromů, sekání trávy, údržba živých plotů, jarní a podzimní úklid zahrad.', null, true, 4.6, 22, '{"author":"Božena J.","stars":5,"text":"Zahrada po zimě zase vypadá k světu. Tuje ořezal přesně podle domluvy."}'::jsonb),
  ('00000000-0000-4000-8000-000000000016', null, true, 'Libor C.', 'Zámečník', 'Kladno', 50.1536, 14.1067, 'Otevírání zabouchnutých dveří, výměna zámků a vložek, zabezpečení dveří. Nonstop pohotovost.', null, true, 4.8, 38, '{"author":"Filip A.","stars":5,"text":"Zabouchnuté dveře otevřel bez poškození, přijel do čtyřiceti minut."}'::jsonb),
  ('00000000-0000-4000-8000-000000000017', null, true, 'Dana H.', 'Zámečnice', 'Rakovník', 50.1078, 13.7214, 'Výměna vložek a kování, opravy vchodových dveří, výroba drobných kovových prvků na zakázku.', null, false, 4.6, 16, '{"author":"Radka N.","stars":5,"text":"Dveře, které se zasekávaly, fungují jako nové. Příjemné jednání."}'::jsonb),
  ('00000000-0000-4000-8000-000000000018', null, true, 'Filip J.', 'Technik klimatizací', 'Slaný', 50.2331, 14.0935, 'Montáž a servis split klimatizací, čištění, doplnění chladiva, poradenství při výběru.', null, true, 4.7, 24, '{"author":"Kamila Z.","stars":5,"text":"Klimatizace nainstalovaná za jeden den, vše funguje a nic nehlučí."}'::jsonb)
on conflict (id) do update set name = excluded.name, role_title = excluded.role_title, town = excluded.town,
  lat = excluded.lat, lng = excluded.lng, description = excluded.description, verified = excluded.verified,
  rating = excluded.rating, review_count = excluded.review_count, sample_review = excluded.sample_review
  where public.craftsmen.is_demo;

-- Kontakty demo řemeslníků (smyšlené)
insert into public.craftsman_contacts (craftsman_id, phone, email) values
  ('00000000-0000-4000-8000-000000000001', '+420 777 000 101', 'pavel.k@example.cz'),
  ('00000000-0000-4000-8000-000000000002', '+420 777 000 102', 'tomas.r@example.cz'),
  ('00000000-0000-4000-8000-000000000003', '+420 777 000 103', 'jana.s@example.cz'),
  ('00000000-0000-4000-8000-000000000004', '+420 777 000 104', 'martin.v@example.cz'),
  ('00000000-0000-4000-8000-000000000005', '+420 777 000 105', 'lukas.h@example.cz'),
  ('00000000-0000-4000-8000-000000000006', '+420 777 000 106', 'ondrej.b@example.cz'),
  ('00000000-0000-4000-8000-000000000007', '+420 777 000 107', 'karel.d@example.cz'),
  ('00000000-0000-4000-8000-000000000008', '+420 777 000 108', 'radek.m@example.cz'),
  ('00000000-0000-4000-8000-000000000009', '+420 777 000 109', 'michal.t@example.cz'),
  ('00000000-0000-4000-8000-000000000010', '+420 777 000 110', 'petr.z@example.cz'),
  ('00000000-0000-4000-8000-000000000011', '+420 777 000 111', 'eva.n@example.cz'),
  ('00000000-0000-4000-8000-000000000012', '+420 777 000 112', 'josef.l@example.cz'),
  ('00000000-0000-4000-8000-000000000013', '+420 777 000 113', 'vojtech.p@example.cz'),
  ('00000000-0000-4000-8000-000000000014', '+420 777 000 114', 'radim.s@example.cz'),
  ('00000000-0000-4000-8000-000000000015', '+420 777 000 115', 'zdenek.f@example.cz'),
  ('00000000-0000-4000-8000-000000000016', '+420 777 000 116', 'libor.c@example.cz'),
  ('00000000-0000-4000-8000-000000000017', '+420 777 000 117', 'dana.h@example.cz'),
  ('00000000-0000-4000-8000-000000000018', '+420 777 000 118', 'filip.j@example.cz')
on conflict (craftsman_id) do update set phone = excluded.phone, email = excluded.email;

-- Obory demo řemeslníků
delete from public.craftsman_categories where craftsman_id in ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000013', '00000000-0000-4000-8000-000000000014', '00000000-0000-4000-8000-000000000015', '00000000-0000-4000-8000-000000000016', '00000000-0000-4000-8000-000000000017', '00000000-0000-4000-8000-000000000018');
insert into public.craftsman_categories (craftsman_id, category_id) values
  ('00000000-0000-4000-8000-000000000001', 'kohoutky'),
  ('00000000-0000-4000-8000-000000000001', 'odpad'),
  ('00000000-0000-4000-8000-000000000001', 'wc'),
  ('00000000-0000-4000-8000-000000000002', 'bojler'),
  ('00000000-0000-4000-8000-000000000002', 'odpad'),
  ('00000000-0000-4000-8000-000000000002', 'voda'),
  ('00000000-0000-4000-8000-000000000003', 'voda'),
  ('00000000-0000-4000-8000-000000000003', 'kohoutky'),
  ('00000000-0000-4000-8000-000000000004', 'zasuvky'),
  ('00000000-0000-4000-8000-000000000004', 'jistice'),
  ('00000000-0000-4000-8000-000000000004', 'osvetleni'),
  ('00000000-0000-4000-8000-000000000005', 'zasuvky'),
  ('00000000-0000-4000-8000-000000000005', 'osvetleni'),
  ('00000000-0000-4000-8000-000000000005', 'elektro'),
  ('00000000-0000-4000-8000-000000000006', 'jistice'),
  ('00000000-0000-4000-8000-000000000006', 'osvetleni'),
  ('00000000-0000-4000-8000-000000000006', 'elektro'),
  ('00000000-0000-4000-8000-000000000007', 'kotel'),
  ('00000000-0000-4000-8000-000000000007', 'radiatory'),
  ('00000000-0000-4000-8000-000000000008', 'radiatory'),
  ('00000000-0000-4000-8000-000000000008', 'topeni'),
  ('00000000-0000-4000-8000-000000000009', 'manzel'),
  ('00000000-0000-4000-8000-000000000010', 'manzel'),
  ('00000000-0000-4000-8000-000000000010', 'zednik'),
  ('00000000-0000-4000-8000-000000000011', 'podlahy-malovani'),
  ('00000000-0000-4000-8000-000000000012', 'podlahy-malovani'),
  ('00000000-0000-4000-8000-000000000013', 'strecha'),
  ('00000000-0000-4000-8000-000000000014', 'strecha'),
  ('00000000-0000-4000-8000-000000000015', 'kaceni'),
  ('00000000-0000-4000-8000-000000000015', 'prorez'),
  ('00000000-0000-4000-8000-000000000015', 'travnik'),
  ('00000000-0000-4000-8000-000000000015', 'ploty'),
  ('00000000-0000-4000-8000-000000000016', 'zamecnik'),
  ('00000000-0000-4000-8000-000000000017', 'zamecnik'),
  ('00000000-0000-4000-8000-000000000017', 'okna-dvere'),
  ('00000000-0000-4000-8000-000000000018', 'klimatizace');

-- Týdenní dostupnost (weekday 1 = pondělí … 7 = neděle)
delete from public.availability_rules where craftsman_id in ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000013', '00000000-0000-4000-8000-000000000014', '00000000-0000-4000-8000-000000000015', '00000000-0000-4000-8000-000000000016', '00000000-0000-4000-8000-000000000017', '00000000-0000-4000-8000-000000000018');
insert into public.availability_rules (craftsman_id, weekday, start_time, end_time) values
  ('00000000-0000-4000-8000-000000000001', 1, '08:00', '12:00'),
  ('00000000-0000-4000-8000-000000000001', 2, '08:00', '12:00'),
  ('00000000-0000-4000-8000-000000000001', 3, '08:00', '12:00'),
  ('00000000-0000-4000-8000-000000000001', 4, '08:00', '12:00'),
  ('00000000-0000-4000-8000-000000000001', 5, '08:00', '12:00'),
  ('00000000-0000-4000-8000-000000000001', 2, '15:00', '18:00'),
  ('00000000-0000-4000-8000-000000000001', 4, '15:00', '18:00'),
  ('00000000-0000-4000-8000-000000000002', 1, '07:00', '15:00'),
  ('00000000-0000-4000-8000-000000000002', 2, '07:00', '15:00'),
  ('00000000-0000-4000-8000-000000000002', 3, '07:00', '15:00'),
  ('00000000-0000-4000-8000-000000000002', 4, '07:00', '15:00'),
  ('00000000-0000-4000-8000-000000000002', 5, '07:00', '15:00'),
  ('00000000-0000-4000-8000-000000000002', 6, '09:00', '13:00'),
  ('00000000-0000-4000-8000-000000000003', 1, '15:00', '18:00'),
  ('00000000-0000-4000-8000-000000000003', 2, '15:00', '18:00'),
  ('00000000-0000-4000-8000-000000000003', 3, '15:00', '18:00'),
  ('00000000-0000-4000-8000-000000000003', 4, '15:00', '18:00'),
  ('00000000-0000-4000-8000-000000000003', 5, '15:00', '18:00'),
  ('00000000-0000-4000-8000-000000000003', 3, '08:00', '12:00'),
  ('00000000-0000-4000-8000-000000000004', 1, '13:00', '17:00'),
  ('00000000-0000-4000-8000-000000000004', 2, '13:00', '17:00'),
  ('00000000-0000-4000-8000-000000000004', 3, '13:00', '17:00'),
  ('00000000-0000-4000-8000-000000000004', 4, '13:00', '17:00'),
  ('00000000-0000-4000-8000-000000000004', 5, '13:00', '17:00'),
  ('00000000-0000-4000-8000-000000000005', 3, '08:00', '16:00'),
  ('00000000-0000-4000-8000-000000000005', 4, '08:00', '16:00'),
  ('00000000-0000-4000-8000-000000000005', 5, '08:00', '16:00'),
  ('00000000-0000-4000-8000-000000000006', 1, '08:00', '12:00'),
  ('00000000-0000-4000-8000-000000000006', 2, '08:00', '12:00'),
  ('00000000-0000-4000-8000-000000000006', 3, '08:00', '12:00'),
  ('00000000-0000-4000-8000-000000000006', 4, '08:00', '12:00'),
  ('00000000-0000-4000-8000-000000000006', 5, '08:00', '12:00'),
  ('00000000-0000-4000-8000-000000000006', 1, '17:00', '20:00'),
  ('00000000-0000-4000-8000-000000000006', 2, '17:00', '20:00'),
  ('00000000-0000-4000-8000-000000000006', 3, '17:00', '20:00'),
  ('00000000-0000-4000-8000-000000000006', 4, '17:00', '20:00'),
  ('00000000-0000-4000-8000-000000000006', 5, '17:00', '20:00'),
  ('00000000-0000-4000-8000-000000000007', 1, '08:00', '16:00'),
  ('00000000-0000-4000-8000-000000000007', 2, '08:00', '16:00'),
  ('00000000-0000-4000-8000-000000000007', 3, '08:00', '16:00'),
  ('00000000-0000-4000-8000-000000000007', 4, '08:00', '16:00'),
  ('00000000-0000-4000-8000-000000000008', 1, '08:00', '12:00'),
  ('00000000-0000-4000-8000-000000000008', 2, '08:00', '12:00'),
  ('00000000-0000-4000-8000-000000000008', 3, '08:00', '12:00'),
  ('00000000-0000-4000-8000-000000000008', 4, '08:00', '12:00'),
  ('00000000-0000-4000-8000-000000000008', 5, '08:00', '12:00'),
  ('00000000-0000-4000-8000-000000000008', 6, '09:00', '13:00'),
  ('00000000-0000-4000-8000-000000000008', 7, '09:00', '13:00'),
  ('00000000-0000-4000-8000-000000000009', 1, '13:00', '17:00'),
  ('00000000-0000-4000-8000-000000000009', 2, '13:00', '17:00'),
  ('00000000-0000-4000-8000-000000000009', 3, '13:00', '17:00'),
  ('00000000-0000-4000-8000-000000000009', 4, '13:00', '17:00'),
  ('00000000-0000-4000-8000-000000000009', 5, '13:00', '17:00'),
  ('00000000-0000-4000-8000-000000000009', 6, '08:00', '12:00'),
  ('00000000-0000-4000-8000-000000000010', 4, '08:00', '16:00'),
  ('00000000-0000-4000-8000-000000000010', 5, '08:00', '16:00'),
  ('00000000-0000-4000-8000-000000000010', 6, '08:00', '14:00'),
  ('00000000-0000-4000-8000-000000000011', 1, '08:00', '16:00'),
  ('00000000-0000-4000-8000-000000000011', 2, '08:00', '16:00'),
  ('00000000-0000-4000-8000-000000000011', 3, '08:00', '16:00'),
  ('00000000-0000-4000-8000-000000000011', 4, '08:00', '16:00'),
  ('00000000-0000-4000-8000-000000000012', 3, '07:00', '15:00'),
  ('00000000-0000-4000-8000-000000000012', 4, '07:00', '15:00'),
  ('00000000-0000-4000-8000-000000000012', 5, '07:00', '15:00'),
  ('00000000-0000-4000-8000-000000000013', 1, '08:00', '12:00'),
  ('00000000-0000-4000-8000-000000000013', 2, '08:00', '12:00'),
  ('00000000-0000-4000-8000-000000000013', 3, '08:00', '12:00'),
  ('00000000-0000-4000-8000-000000000013', 4, '08:00', '12:00'),
  ('00000000-0000-4000-8000-000000000013', 5, '08:00', '12:00'),
  ('00000000-0000-4000-8000-000000000014', 4, '08:00', '16:00'),
  ('00000000-0000-4000-8000-000000000014', 5, '08:00', '16:00'),
  ('00000000-0000-4000-8000-000000000015', 1, '08:00', '16:00'),
  ('00000000-0000-4000-8000-000000000015', 2, '08:00', '16:00'),
  ('00000000-0000-4000-8000-000000000015', 3, '08:00', '16:00'),
  ('00000000-0000-4000-8000-000000000015', 4, '08:00', '16:00'),
  ('00000000-0000-4000-8000-000000000015', 5, '08:00', '16:00'),
  ('00000000-0000-4000-8000-000000000015', 6, '08:00', '12:00'),
  ('00000000-0000-4000-8000-000000000016', 1, '00:00', '23:59'),
  ('00000000-0000-4000-8000-000000000016', 2, '00:00', '23:59'),
  ('00000000-0000-4000-8000-000000000016', 3, '00:00', '23:59'),
  ('00000000-0000-4000-8000-000000000016', 4, '00:00', '23:59'),
  ('00000000-0000-4000-8000-000000000016', 5, '00:00', '23:59'),
  ('00000000-0000-4000-8000-000000000016', 6, '00:00', '23:59'),
  ('00000000-0000-4000-8000-000000000016', 7, '00:00', '23:59'),
  ('00000000-0000-4000-8000-000000000017', 1, '08:00', '12:00'),
  ('00000000-0000-4000-8000-000000000017', 2, '08:00', '12:00'),
  ('00000000-0000-4000-8000-000000000017', 3, '08:00', '12:00'),
  ('00000000-0000-4000-8000-000000000017', 4, '08:00', '12:00'),
  ('00000000-0000-4000-8000-000000000017', 5, '08:00', '12:00'),
  ('00000000-0000-4000-8000-000000000018', 3, '08:00', '16:00'),
  ('00000000-0000-4000-8000-000000000018', 4, '08:00', '16:00'),
  ('00000000-0000-4000-8000-000000000018', 5, '08:00', '16:00');

-- Výjimky (relativně k datu spuštění seedu; is_available = false → nepracuje)
delete from public.availability_exceptions where craftsman_id in ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000013', '00000000-0000-4000-8000-000000000014', '00000000-0000-4000-8000-000000000015', '00000000-0000-4000-8000-000000000016', '00000000-0000-4000-8000-000000000017', '00000000-0000-4000-8000-000000000018');
insert into public.availability_exceptions (craftsman_id, date, is_available, note) values
  ('00000000-0000-4000-8000-000000000001', current_date + 3, false, 'Dovolená'),
  ('00000000-0000-4000-8000-000000000004', current_date + 1, false, 'Školení'),
  ('00000000-0000-4000-8000-000000000005', current_date + 2, true, 'Extra den');

commit;
