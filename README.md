# FixIt

> **Ukázkový prototyp, data jsou smyšlená.** Školní projekt (Základy podnikání). Rozhraní je česky.

FixIt je statický web, kde člověk popíše problém v domácnosti (např. „kape mi kohoutek“) a dostane
**nejbližší vhodné řemeslníky** na mapě i v seznamu, **orientační odhad ceny** a jejich **nejbližší volný termín**.
Řemeslníci se mohou zaregistrovat, vyplnit profil a nastavit dostupnost.

- Čisté **HTML, CSS a JavaScript bez build kroku** – běží na GitHub Pages (hashové routování).
- Bez nastavení běží v **záložním režimu**: lokální data + OpenStreetMap. Po vyplnění `config.js` se
  **automaticky přepne** na Supabase (data, přihlášení) a Mapy.com (mapa, adresy).
- Barevná paleta: `#BA1200` · `#031927` · `#9DD1F1` · `#508AA8` · `#C8E0F4`.

## Obsah

1. [Struktura souborů](#struktura-souborů)
2. [Spuštění lokálně](#spuštění-lokálně)
3. [Konfigurace (`config.js`)](#konfigurace-configjs)
4. [Nastavení Supabase](#nastavení-supabase)
5. [Nastavení Mapy.com](#nastavení-mapycom)
6. [Nasazení na GitHub Pages](#nasazení-na-github-pages)
7. [Jak to funguje](#jak-to-funguje)
8. [Co je v demu simulované](#co-je-v-demu-simulované)
9. [Co by bylo potřeba pro ostrý provoz](#co-by-bylo-potřeba-pro-ostrý-provoz)

## Struktura souborů

```
.
├── index.html             # kostra stránky, modální okna (role, přihlášení, chat)
├── style.css              # vzhled, paleta jako CSS proměnné, responzivita
├── config.js              # TVÉ klíče (veřejné!) – prázdné = záložní režim
├── config.example.js      # vzor bez hodnot
├── util.js                # pomocné funkce, localStorage (prefix fixit:), modální okna, toasty
├── data.js                # lokální data: strom kategorií, ceník, 18 smyšlených řemeslníků + dostupnost
├── maps.js                # vrstva map: geocode / suggest / tileLayer (Mapy.com nebo OSM)
├── categories.js          # strom kategorií, classifyProblem, výběr kategorie, odhad ceny
├── availability.js        # nextAvailability + editor týdenních oken a výjimek
├── address-input.js       # pole adresy s našeptáváním (debounce)
├── data-source.js         # adaptéry `local` a `supabase` (data + přihlášení)
├── auth.js                # okno přihlášení / registrace / obnovy hesla, stav v hlavičce
├── pages.js               # #/poplatky, #/registrace-remeslnika, #/profil
├── app.js                 # role, router, vyhledávání, výsledky, mapa, chat
├── supabase/
│   ├── schema.sql         # tabulky, trigger pro profiles, RLS, oprávnění (spustíš ručně)
│   └── seed.sql           # kategorie, ceník, 18 demo řemeslníků (generovaný, spustíš ručně)
├── tools/build-seed.mjs   # z data.js vygeneruje supabase/seed.sql
├── screenshots/           # aktuální snímky obrazovek
└── README.md
```

Žádný build ani npm závislosti pro web. Knihovny z CDN: Leaflet 1.9.4 (unpkg, s SRI) a při zapnuté
Supabase `supabase-js` **2.117.3** (jsDelivr, pevná verze + SRI, načítá se jen při vyplněné konfiguraci).
Písmo Plus Jakarta Sans z Google Fonts (při nedostupnosti systémové písmo).

## Spuštění lokálně

Web se musí otevřít přes jednoduchý server (ne z `file://`):

```bash
cd FixIt
python3 -m http.server 8000
# nebo: npx serve .
```

Pak otevři <http://localhost:8000>. **Funguje hned**, bez jakýchkoli klíčů (záložní režim). Potřebuješ
jen připojení k internetu pro dlaždice mapy a vyhledání adresy.

V záložním režimu je přihlášení **simulované** (jméno a e-mail uložené v prohlížeči, heslo se
nevyžaduje ani neukládá) a je to v okně přihlášení viditelně označené.

## Konfigurace (`config.js`)

`config.js` vyplňuješ ručně. Vzor je `config.example.js`.

```js
window.FIXIT_CONFIG = {
  SUPABASE_URL: '',        // https://xxxx.supabase.co
  SUPABASE_ANON_KEY: '',   // veřejný „anon“ / „publishable“ klíč
  MAPY_API_KEY: '',        // klíč z developer.mapy.com
};
```

| Hodnota | Prázdná | Vyplněná |
|---|---|---|
| `SUPABASE_URL` + `SUPABASE_ANON_KEY` | lokální data, simulované přihlášení | data i přihlášení ze Supabase |
| `MAPY_API_KEY` | OpenStreetMap + Nominatim | dlaždice, geokódování a **našeptávání adres** z Mapy.com |

**Do klienta patří jen veřejné klíče.** Klíč `service_role` ani `sb_secret_…` sem nikdy nevkládej. Aplikace
takový klíč pozná, odmítne ho použít a ukáže varování. Veřejný anon klíč chrání Row Level Security v databázi.

Když se Supabase nepodaří načíst (špatná adresa, výpadek), aplikace sama přejde do záložního režimu
a řekne to. Stav je vidět v horním pruhu („Data: …“, „Mapa: …“).

## Nastavení Supabase

1. Na <https://supabase.com> vytvoř projekt.
2. **SQL Editor → New query**: vlož celý obsah `supabase/schema.sql` a spusť (**Run**).
3. Nová query: vlož `supabase/seed.sql` a spusť. Skripty jsou opakovatelné.
4. **Project Settings → API**: zkopíruj *Project URL* a *anon public key* do `config.js`.
5. **Authentication → URL Configuration**:
   - **Site URL**: adresa nasazeného webu, např. `https://<uživatel>.github.io/<repozitář>/`
   - **Redirect URLs** (přidej obě): `https://<uživatel>.github.io/<repozitář>/` a `http://localhost:8000/`
   - (U e-mailů se používá PKCE: odkaz vede na `…/?code=…`, ne na `#`, aby se to nepralo s hashovým routováním.)
6. **Authentication → Providers → Email**: nech zapnuté přihlášení e-mailem a heslem. Chceš-li
   potvrzování e-mailu, nech *Confirm email* zapnuté (web to umí: po registraci řekne, ať se klikne na odkaz).
7. Zkus registraci. Po ní vznikne řádek v `profiles` (id = `auth.uid()`, role, display_name) díky triggeru
   `on_auth_user_created`.

Změnila-li se data v `data.js` (kategorie, ceník, demo řemeslníci), přegeneruj seed:

```bash
node tools/build-seed.mjs     # přepíše supabase/seed.sql
```

### Bezpečnostní model databáze

- **RLS je zapnuté u všech tabulek.** Navíc jsou oprávnění omezená na úrovni sloupců.
- Anonymně se čtou: `categories`, `price_guides`, `craftsmen` (bez `user_id`), `craftsman_categories`,
  `availability_*` a **kontakty jen demo řemeslníků** (`craftsman_contacts`; telefony a e-maily skutečných
  řemeslníků vidí jen oni sami).
- Zapisovat lze jen vlastní řádky (`user_id = auth.uid()`). Řemeslník si **nemůže nastavit** `verified`,
  `rating`, `review_count` ani `is_demo`.
- **Demo řemeslníci** (`user_id = null`, `is_demo = true`) se přes API nedají změnit, smazat ani jim přidat
  dostupnost či obory.
- Profil v `profiles` vytváří databázový trigger z metadat registrace (role jiná než `client` / `craftsman`
  se změní na `client`).

## Nastavení Mapy.com

1. Na <https://developer.mapy.com> si vytvoř účet a **API klíč**.
2. V konzoli klíč **omez na svou doménu** (`<uživatel>.github.io` a `localhost`), protože je veřejný.
3. Vlož ho do `MAPY_API_KEY`.

Použité funkce REST API (ověřeno podle dokumentace na <https://api.mapy.com/v1/docs/>):
`/v1/maptiles/basic/{256|256@2x}/{z}/{x}/{y}` (dlaždice), `/v1/geocode`, `/v1/suggest`.

**Atribuce (povinná):** nad mapou je klikací **logo Mapy.com** (výška 30 px, odkaz na <https://mapy.com/>)
a text **„© Seznam.cz a.s. and others“** s odkazem na <https://api.mapy.com/copyright>. Logo je také v seznamu
našeptávaných adres a u pole adresy, text je i v patičce. Při použití OpenStreetMap se zobrazuje atribuce OSM.
Odstranění nebo skrytí těchto prvků odporuje podmínkám služby.

Chyby API (špatný klíč 401/403, příliš mnoho dotazů 429, výpadek sítě) se zachytí a ukážou srozumitelnou
hláškou; hledání pak lze dokončit výběrem nejbližší obce.

> Našeptávání adres při psaní (s debounce 300 ms) funguje jen s klíčem Mapy.com. Veřejný Nominatim
> automatické doplňování zakazuje, proto se s OpenStreetMap nenašeptává.

## Nasazení na GitHub Pages

1. Nahraj obsah složky do repozitáře na GitHubu tak, aby `index.html` ležel v **kořeni**. **Nahraj i
   `config.js`** (obsahuje jen veřejné klíče). Bez něj by web po nasazení klíče nenačetl.
2. **Settings → Pages → Build and deployment**: *Source* **Deploy from a branch**, *Branch* **main**,
   složka **/ (root)**.
3. Za minutu nebo dvě bude web na `https://<uživatel>.github.io/<repozitář>/`.
4. Ověř v Supabase (krok 5 výše), že tato adresa je v *Site URL* a *Redirect URLs*.

Routy jsou hashové (`#/`, `#/hledat`, `#/poplatky`, `#/profil`, `#/registrace-remeslnika`), takže GitHub Pages
nepotřebuje žádná přesměrování. Obnovení stránky i tlačítko Zpět fungují. Výsledky hledání nesou parametry
v adrese (`#/hledat?lat=…&lng=…&kat=…&q=…`), takže je lze sdílet.

## Jak to funguje

- **Role** (modální okno při první návštěvě, uložené jako `fixit:role`, změna v záhlaví):
  *klient* vidí vyhledávání; *řemeslník* vidí Registrace řemeslníka, Můj profil a Ceník poplatků;
  „Jen se podívám“ = jen vyhledávání. Po přihlášení se role převezme z účtu.
- **Kategorie** jsou data (tabulka `categories`, strom o max. 3 úrovních). Výběr je proklik po úrovních
  (dlaždice + drobečková navigace) a vyhledávací pole, které strom filtruje.
- **`classifyProblem(text)`** čte klíčová slova z `categories.keywords` (bez diakritiky, od začátku slova),
  při shodě více oborů vybere nejvíc zásahů, při rovnosti nejbližšího společného předka. Zápach plynu spustí
  výrazné upozornění (**1239 / 112**).
- **Orientační odhad ceny** (`price_guides`): rozpětí sazby, případně výjezd a typický rozsah práce,
  vysvětlení, co cenu ovlivní, a upozornění, že konečnou cenu určuje řemeslník. Nikdy se nezobrazí jediné číslo
  (údaj „od cca“ má otevřené rozpětí). Pro kategorii bez záznamu se napíše *„Cenu vám řemeslník upřesní po
  poptávce“*. Záznam se hledá od kategorie nahoru ve stromu (kohoutky zdědí sazbu instalatéra).
  **Všechny ceny jsou ilustrativní** a označené; chybějící údaje (výjezd, rozsah práce) jsou `null`, nic se nevymýšlí.
- **Dostupnost**: `availability_rules` (týdenní okna) a `availability_exceptions` (výjimky). `nextAvailability`
  vrací „Dnes volný do 16:00“, „Dnes po 16:00“, „Zítra 8–12“, „Pondělí 8–16“. Karta ji ukazuje, je tu filtr
  **Volní dnes** a řazení podle nejbližšího termínu. Řemeslník si okna a výjimky nastavuje v Můj profil.
- **Poplatky** (`#/poplatky`): pro klienta zdarma; řemeslník 100 Kč za odemčený kontakt a volitelný prémiový
  profil 299 Kč měsíčně, kalkulačka, FAQ. **Jde o návrh ceníku v rámci školního projektu, ne závazné ceny.**
- **Přihlášení** (Supabase Auth, e-mail + heslo, obnova hesla) se vyžaduje až pro: psaní zprávy řemeslníkovi,
  ukládání oblíbených a úpravu profilu řemeslníka. Hledání funguje bez přihlášení.
- **Data** jdou přes `data-source.js` se dvěma adaptéry (`local`, `supabase`) se stejným rozhraním, **mapy** přes
  `maps.js` (`geocode`, `suggest`, `tileLayer`).
- **localStorage** používá výhradně klíče s prefixem `fixit:` a každý přístup je v `try/catch`.

## Co je v demu simulované

- **Určení oboru** – jednoduchá pravidla (klíčová slova), žádná AI.
- **Řemeslníci** – 18 vymyšlených (jména, telefony `+420 777 000 1xx`, e-maily na `example.cz`, recenze,
  hodnocení, odznak „Ověřený“, termíny).
- **Chat a poptávky** – odpovědi řemeslníků jsou předpřipravené a označené „Ukázková odpověď (demo)“, zpráva
  nikam neodchází. Konverzace se ukládá lokálně (`fixit:chat:<uživatel>:<řemeslník>`) a psát smí jen přihlášený.
- **Odemykání kontaktů za 100 Kč** – jen návrh; kontakt skutečných (nedemo) řemeslníků je v seznamu zamčený.
- **Ověření řemeslníka** (`verified`) – ukázkový příznak, nastavuje ho jen správce databáze.
- **Ceny** – ilustrativní (viz výše).
- **Záložní přihlášení** bez Supabase – jen simulace.

## Co by bylo potřeba pro ostrý provoz

1. **Skutečné ověřování** totožnosti a živnostenského oprávnění (např. živnostenský rejstřík).
2. **AI určení oboru** přes vlastní backend (klíč modelu nikdy v prohlížeči); zachovat tvar návratové hodnoty
   `classifyProblem` a upozornění na plyn.
3. **Skutečný chat, poptávky a notifikace** (Supabase Realtime, e-mail / SMS) a skutečné odemykání kontaktů s platbou.
4. **Rezervace** napojené na dostupnost, potvrzování termínů.
5. **Recenze** jen od ověřených zákazníků po dokončené zakázce, moderace.
6. **Ceník** z ověřených zdrojů (u záznamů vyplnit `source` konkrétním odkazem) a regionální rozdíly.
7. **Provoz služeb**: vlastní SMTP pro e-maily Supabase, limity a monitoring, placený tarif Mapy.com při vyšším provozu.
8. **Právní stránka**: obchodní podmínky, ochrana osobních údajů (GDPR), cookies.
9. **Obchodní model** (téma předmětu): ověřit ochotu řemeslníků platit za kontakt, porovnat s provizí.

## Přístupnost

Viditelný focus, popisky polí, ovládání klávesnicí (kategorie jsou tlačítka s `aria-pressed`, pole adresy je
`combobox` se šipkami a Enter, okna drží fokus a zavírají se Esc), alt texty u avatarů, kontrastní barvy z palety,
respektování `prefers-reduced-motion`, ovládání použitelné na mobilu od šířky 390 px.
