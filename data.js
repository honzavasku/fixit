/* ==========================================================================
   data.js – ukázková data pro prototyp „Řemeslník na dosah“
   --------------------------------------------------------------------------
   !! Všechna jména, telefony a e-maily jsou vymyšlené. Telefony jsou ve
   !! tvaru +420 777 000 1xx, e-maily na doméně example.cz.

   Data jsou záměrně v jednom poli objektů (CRAFTSMEN) a app.js je získává
   přes funkci loadCraftsmen(). Pro ostrý provoz stačí tělo této funkce
   nahradit načtením z databáze (např. Supabase) – zbytek aplikace se
   nemění. Tvar jednoho záznamu je popsán u prvního řemeslníka.
   ========================================================================== */

/* Kategorie problémů. `icon` jsou SVG cesty pro viewBox 24×24 (obrys, bez výplně).
   `trade` je název řemeslníka použitý v souhrnu výsledků. */
const CATEGORIES = [
  { id: 'voda',      label: 'Voda a odpady',        trade: 'instalatér',            icon: '<path d="M12 3s6 6.2 6 10.5A6 6 0 0 1 6 13.5C6 9.2 12 3 12 3z"/>' },
  { id: 'elektro',   label: 'Elektřina',            trade: 'elektrikář',            icon: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>' },
  { id: 'topeni',    label: 'Topení a plyn',        trade: 'topenář a plynař',      icon: '<path d="M12 22c4 0 7-2.7 7-6.5 0-3-2-5-3.5-6.5.2 2-.8 3-2 3 .5-3-1.5-6-4-8 0 4-4.5 6-4.5 11.5C5 19.3 8 22 12 22z"/>' },
  { id: 'manzel',    label: 'Hodinový manžel',      trade: 'hodinový manžel',       icon: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.1L3 17.7 6.3 21l6.3-6.3a4 4 0 0 0 5.1-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>' },
  { id: 'malovani',  label: 'Malování a podlahy',   trade: 'malíř a podlahář',      icon: '<rect x="4" y="3" width="14" height="6" rx="1.5"/><path d="M18 6h2v5h-8v3"/><rect x="10" y="14" width="4" height="7" rx="1"/>' },
  { id: 'strecha',   label: 'Střecha a fasáda',     trade: 'pokrývač a fasádník',   icon: '<path d="M3 12 12 4l9 8M6 10v10h12V10"/>' },
  { id: 'zahrada',   label: 'Zahrada a stromy',     trade: 'zahradník',             icon: '<path d="M12 22v-7"/><path d="M12 15c-4 0-6-2.5-6-5.5 0-2 1.3-3.5 3-4 .5-1.5 1.7-2.5 3-2.5s2.5 1 3 2.5c1.7.5 3 2 3 4 0 3-2 5.5-6 5.5z"/>' },
  { id: 'zamecnik',  label: 'Zámečník a dveře',     trade: 'zámečník',              icon: '<circle cx="8" cy="15" r="4"/><path d="M11 12 20 3M16 7l3 3M14 9l2 2"/>' },
  { id: 'klima',     label: 'Klimatizace',          trade: 'technik klimatizací',   icon: '<path d="M12 2v20M4 7l16 10M4 17 20 7"/>' },
  { id: 'jine',      label: 'Jiné',                 trade: 'různé obory',           icon: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17h.01"/>' },
];

/* Hotové obce pro případ, že se adresu nepodaří převést na souřadnice. */
const TOWNS = [
  { name: 'Rakovník',      lat: 50.1041, lng: 13.7310 },
  { name: 'Tuchlovice',    lat: 50.1381, lng: 13.9911 },
  { name: 'Kladno',        lat: 50.1466, lng: 14.1026 },
  { name: 'Nové Strašecí', lat: 50.1533, lng: 13.8998 },
  { name: 'Slaný',         lat: 50.2307, lng: 14.0869 },
  { name: 'Křivoklát',     lat: 50.0379, lng: 13.8704 },
];

/* Řemeslníci (vymyšlení). Pole:
   id, name, role (konkrétní označení), category (id z CATEGORIES), town,
   lat/lng (přibližně, v okolí obce), phone, email, description,
   verified (ověřená totožnost + živnost), rating (průměr 1–5), reviewCount,
   review {author, stars, text} (ukázková recenze),
   availability {text, days} – `text` se zobrazí, `days` slouží k řazení
   „nejdříve volný“ (0 = dnes, 1 = zítra, …). */
const CRAFTSMEN = [
  {
    id: 'r01', name: 'Pavel K.', role: 'Instalatér', category: 'voda', town: 'Rakovník',
    lat: 50.1062, lng: 13.7385, phone: '+420 777 000 101', email: 'pavel.k@example.cz',
    description: 'Opravy kohoutků, sifonů a baterií, čištění odpadů, výměna WC. Do hodiny od zavolání vím, jak velká oprava to bude.',
    verified: true, rating: 4.8, reviewCount: 37,
    review: { author: 'Jitka M.', stars: 5, text: 'Přijel druhý den ráno, kohoutek opravil za půl hodiny a uklidil po sobě.' },
    availability: { text: 'zítra 8–12', days: 1 },
  },
  {
    id: 'r02', name: 'Tomáš R.', role: 'Instalatér', category: 'voda', town: 'Tuchlovice',
    lat: 50.1405, lng: 13.9852, phone: '+420 777 000 102', email: 'tomas.r@example.cz',
    description: 'Rodinné domy i byty: rozvody vody, bojlery, ucpané odpady. Pracuji i o víkendech po domluvě.',
    verified: false, rating: 4.6, reviewCount: 21,
    review: { author: 'Marek L.', stars: 4, text: 'Poctivá práce a férová cena, jen jsem čekal o den déle, než slíbil.' },
    availability: { text: 'volno od pondělí', days: 4 },
  },
  {
    id: 'r03', name: 'Jana S.', role: 'Instalatérka', category: 'voda', town: 'Kladno',
    lat: 50.1511, lng: 14.0950, phone: '+420 777 000 103', email: 'jana.s@example.cz',
    description: 'Havárie vody, vodoměry, rekonstrukce koupelen. Vždy předem řeknu orientační cenu.',
    verified: true, rating: 4.9, reviewCount: 54,
    review: { author: 'Petra V.', stars: 5, text: 'Prasklá hadička pod dřezem, přijela ještě ten den a vše vyřešila.' },
    availability: { text: 'dnes 15–18', days: 0 },
  },
  {
    id: 'r04', name: 'Martin V.', role: 'Elektrikář', category: 'elektro', town: 'Rakovník',
    lat: 50.0998, lng: 13.7292, phone: '+420 777 000 104', email: 'martin.v@example.cz',
    description: 'Opravy zásuvek, jističů a rozvaděčů, výměna osvětlení, revize elektroinstalace v bytech i domech.',
    verified: true, rating: 4.7, reviewCount: 42,
    review: { author: 'Hana B.', stars: 5, text: 'Našel příčinu, proč mi stále vypadával jistič. Vše vysvětlil srozumitelně.' },
    availability: { text: 'zítra 13–17', days: 1 },
  },
  {
    id: 'r05', name: 'Lukáš H.', role: 'Elektrikář', category: 'elektro', town: 'Nové Strašecí',
    lat: 50.1580, lng: 13.9061, phone: '+420 777 000 105', email: 'lukas.h@example.cz',
    description: 'Elektroinstalace v novostavbách i rekonstrukcích, chytré vypínače, nabíjecí stanice pro auta.',
    verified: false, rating: 4.5, reviewCount: 18,
    review: { author: 'Roman T.', stars: 4, text: 'Dobrá práce, jen komunikace e-mailem trvala déle.' },
    availability: { text: 'volno od středy', days: 3 },
  },
  {
    id: 'r06', name: 'Ondřej B.', role: 'Elektrikář', category: 'elektro', town: 'Kladno',
    lat: 50.1389, lng: 14.1124, phone: '+420 777 000 106', email: 'ondrej.b@example.cz',
    description: 'Hledání poruch, výpadky proudu, opravy po zkratu. Mám revizní oprávnění pro běžné domácnosti.',
    verified: true, rating: 4.9, reviewCount: 63,
    review: { author: 'Alena P.', stars: 5, text: 'Přijel večer, nejde světlo vyřešil za deset minut. Doporučuji.' },
    availability: { text: 'pozítří 8–12', days: 2 },
  },
  {
    id: 'r07', name: 'Karel D.', role: 'Topenář a plynař', category: 'topeni', town: 'Slaný',
    lat: 50.2268, lng: 14.0801, phone: '+420 777 000 107', email: 'karel.d@example.cz',
    description: 'Servis plynových kotlů, výměna radiátorů, odvzdušnění a vyvážení topné soustavy před sezónou.',
    verified: true, rating: 4.4, reviewCount: 29,
    review: { author: 'Eliška K.', stars: 4, text: 'Kotel po servisu běží tišeji. Termín jsme museli trochu posunout.' },
    availability: { text: 'volno od pondělí', days: 4 },
  },
  {
    id: 'r08', name: 'Radek M.', role: 'Topenář', category: 'topeni', town: 'Rakovník',
    lat: 50.1109, lng: 13.7248, phone: '+420 777 000 108', email: 'radek.m@example.cz',
    description: 'Radiátory, podlahové topení, výměna oběhových čerpadel a termostatů. Servis i o víkendu.',
    verified: true, rating: 4.8, reviewCount: 33,
    review: { author: 'Ivo Č.', stars: 5, text: 'Radiátor v obýváku byl studený, během hodiny topil jako nový.' },
    availability: { text: 'zítra 8–12', days: 1 },
  },
  {
    id: 'r09', name: 'Michal T.', role: 'Hodinový manžel', category: 'manzel', town: 'Tuchlovice',
    lat: 50.1349, lng: 13.9967, phone: '+420 777 000 109', email: 'michal.t@example.cz',
    description: 'Montáž nábytku a polic, drobné opravy v domácnosti, výměna klik, těsnění oken a dveří.',
    verified: false, rating: 4.6, reviewCount: 47,
    review: { author: 'Lenka F.', stars: 5, text: 'Za jedno odpoledne zvládl smontovat skříň, pověsit police i opravit dvířka.' },
    availability: { text: 'zítra 13–17', days: 1 },
  },
  {
    id: 'r10', name: 'Petr Z.', role: 'Hodinový manžel', category: 'manzel', town: 'Kladno',
    lat: 50.1442, lng: 14.1198, phone: '+420 777 000 110', email: 'petr.z@example.cz',
    description: 'Drobné zednické a truhlářské práce, montáž kuchyní, opravy po bytových revitalizacích.',
    verified: false, rating: 4.3, reviewCount: 15,
    review: { author: 'Zuzana D.', stars: 4, text: 'Solidní práce, ceny odpovídají. Příště bych uvítala dřívější potvrzení termínu.' },
    availability: { text: 'volno od čtvrtka', days: 5 },
  },
  {
    id: 'r11', name: 'Eva N.', role: 'Malířka', category: 'malovani', town: 'Rakovník',
    lat: 50.1015, lng: 13.7421, phone: '+420 777 000 111', email: 'eva.n@example.cz',
    description: 'Malování bytů a domů, štukování, tapetování. Pracuji čistě, nábytek přikrývám a po práci uklízím.',
    verified: true, rating: 4.9, reviewCount: 26,
    review: { author: 'Tereza H.', stars: 5, text: 'Vymalovaný byt 3+1 za dva dny, žádná skvrna, krásně rovné hrany.' },
    availability: { text: 'volno od pondělí', days: 4 },
  },
  {
    id: 'r12', name: 'Josef L.', role: 'Malíř a podlahář', category: 'malovani', town: 'Stochov',
    lat: 50.1495, lng: 13.9591, phone: '+420 777 000 112', email: 'josef.l@example.cz',
    description: 'Pokládka plovoucích podlah a vinylu, broušení parket, malování stropů a stěn.',
    verified: false, rating: 4.5, reviewCount: 31,
    review: { author: 'Michaela S.', stars: 4, text: 'Podlaha v obýváku vypadá skvěle. Trochu se protáhla dodávka materiálu.' },
    availability: { text: 'volno od středy', days: 3 },
  },
  {
    id: 'r13', name: 'Vojtěch P.', role: 'Pokrývač', category: 'strecha', town: 'Křivoklát',
    lat: 50.0402, lng: 13.8741, phone: '+420 777 000 113', email: 'vojtech.p@example.cz',
    description: 'Opravy střech a komínů, výměna tašek, oplechování, zatékání do střešního pláště.',
    verified: true, rating: 4.7, reviewCount: 19,
    review: { author: 'Dagmar R.', stars: 5, text: 'Zatékání po bouři opravil provizorně ještě týž den, pak přijel na pořádnou opravu.' },
    availability: { text: 'pozítří 8–12', days: 2 },
  },
  {
    id: 'r14', name: 'Radim Š.', role: 'Pokrývač a klempíř', category: 'strecha', town: 'Rakovník',
    lat: 50.0965, lng: 13.7358, phone: '+420 777 000 114', email: 'radim.s@example.cz',
    description: 'Okapy, svody, klempířské prvky, nátěry střech a fasády. Pracuji s lešením i lanem.',
    verified: false, rating: 4.4, reviewCount: 12,
    review: { author: 'Václav O.', stars: 4, text: 'Okapy vyměnil rychle a čistě. Cena byla trochu vyšší, než jsem čekal.' },
    availability: { text: 'volno od čtvrtka', days: 5 },
  },
  {
    id: 'r15', name: 'Zdeněk F.', role: 'Zahradník', category: 'zahrada', town: 'Lány',
    lat: 50.1269, lng: 13.9502, phone: '+420 777 000 115', email: 'zdenek.f@example.cz',
    description: 'Řez a kácení stromů, sekání trávy, údržba živých plotů, jarní a podzimní úklid zahrad.',
    verified: true, rating: 4.6, reviewCount: 22,
    review: { author: 'Božena J.', stars: 5, text: 'Zahrada po zimě zase vypadá k světu. Tuje ořezal přesně podle domluvy.' },
    availability: { text: 'volno od pondělí', days: 4 },
  },
  {
    id: 'r16', name: 'Libor C.', role: 'Zámečník', category: 'zamecnik', town: 'Kladno',
    lat: 50.1536, lng: 14.1067, phone: '+420 777 000 116', email: 'libor.c@example.cz',
    description: 'Otevírání zabouchnutých dveří, výměna zámků a vložek, zabezpečení dveří. Nonstop pohotovost.',
    verified: true, rating: 4.8, reviewCount: 38,
    review: { author: 'Filip A.', stars: 5, text: 'Zabouchnuté dveře otevřel bez poškození, přijel do čtyřiceti minut.' },
    availability: { text: 'dnes večer (pohotovost)', days: 0 },
  },
  {
    id: 'r17', name: 'Dana H.', role: 'Zámečnice', category: 'zamecnik', town: 'Rakovník',
    lat: 50.1078, lng: 13.7214, phone: '+420 777 000 117', email: 'dana.h@example.cz',
    description: 'Výměna vložek a kování, opravy vchodových dveří, výroba drobných kovových prvků na zakázku.',
    verified: false, rating: 4.6, reviewCount: 16,
    review: { author: 'Radka N.', stars: 5, text: 'Dveře, které se zasekávaly, fungují jako nové. Příjemné jednání.' },
    availability: { text: 'zítra 8–12', days: 1 },
  },
  {
    id: 'r18', name: 'Filip J.', role: 'Technik klimatizací', category: 'klima', town: 'Slaný',
    lat: 50.2331, lng: 14.0935, phone: '+420 777 000 118', email: 'filip.j@example.cz',
    description: 'Montáž a servis split klimatizací, čištění, doplnění chladiva, poradenství při výběru.',
    verified: true, rating: 4.7, reviewCount: 24,
    review: { author: 'Kamila Z.', stars: 5, text: 'Klimatizace nainstalovaná za jeden den, vše funguje a nic nehlučí.' },
    availability: { text: 'volno od středy', days: 3 },
  },
];

/* Zdroj dat pro aplikaci. Později stačí nahradit např. voláním Supabase:
     const { data } = await supabase.from('craftsmen').select('*'); return data;
   (pole v databázi by měla odpovídat tvaru záznamů výše). */
async function loadCraftsmen() {
  return CRAFTSMEN;
}
