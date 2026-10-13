# Řemeslník na dosah

> **Ukázkový prototyp, data jsou smyšlená.**

Statický prototyp webu, kde člověk popíše problém v domácnosti (např. „kape mi kohoutek“)
a web mu ukáže nejbližší vhodné řemeslníky na mapě i v seznamu. Školní projekt
(Základy podnikání). Veškerý text v rozhraní je česky.

## Struktura souborů

```
.
├── index.html     # obě obrazovky (formulář, výsledky) a okno chatu
├── style.css      # vzhled, paleta jako CSS proměnné, responzivita
├── app.js         # logika: classifyProblem, geocode, distanceKm, renderCards, chat
├── data.js        # smyšlená data (kategorie, obce, řemeslníci) + loadCraftsmen()
├── screenshots/   # screenshoty formuláře, výsledků a chatu
└── README.md
```

Žádný build, backend ani framework. Mapa je Leaflet 1.9.4 z CDN (unpkg) s dlaždicemi
OpenStreetMap a povinnou atribucí, písmo Plus Jakarta Sans z Google Fonts (při
nedostupnosti se použije systémové písmo).

## Spuštění lokálně

Stránka se musí otevřít přes jednoduchý lokální server (kvůli dlaždicím mapy a
geokódování, které z `file://` často nefungují):

```bash
cd FixIt
python3 -m http.server 8000
# nebo: npx serve .
```

Pak otevřete <http://localhost:8000>. Je potřeba připojení k internetu (mapa,
Leaflet, Nominatim).

## Nasazení na GitHub Pages

1. Nahrajte obsah složky (soubory `index.html`, `style.css`, `app.js`, `data.js`…) do
   repozitáře na GitHubu tak, aby `index.html` ležel v **kořeni** repozitáře.
2. V repozitáři otevřete **Settings → Pages**.
3. V části *Build and deployment* zvolte *Source:* **Deploy from a branch**,
   *Branch:* **main**, složka **/ (root)** a uložte.
4. Za minutu nebo dvě bude web na `https://<uživatel>.github.io/<repozitář>/`.

## Jak to funguje

- **Formulář:** kategorie (nepovinně), adresa, popis problému. Když kategorie není
  vybrána, určí ji `classifyProblem(text)` z klíčových slov bez diakritiky
  (kohoutek/teče/odpad → instalatér, zásuvka/jistič/proud → elektrikář, kotel/radiátor/topení → topení…).
  Při popisu zápachu plynu se zobrazí výrazné upozornění (uzávěr, vyvětrat, 1239 / 112).
- **Adresa → souřadnice:** `geocode(address)` volá Nominatim (OpenStreetMap), omezeno na
  Česko, nejvýš 1 dotaz za sekundu. Když selže, nabídne se výběr z hotových obcí
  (Rakovník, Tuchlovice, Kladno, Nové Strašecí, Slaný, Křivoklát) a hledání pokračuje s nimi.
- **Výsledky:** mapa (60 %) + seznam (40 %), řazení podle vzdálenosti / hodnocení /
  nejbližšího termínu. Vzdálenost se počítá vzorcem haversine (`distanceKm`), hledá se do 30 km.
  Kliknutí na značku zvýrazní kartu a naopak. Na mobilu se mapa a seznam přepínají záložkami.
- **Chat:** první zpráva je popis problému, odpověď řemeslníka je simulovaná a označená
  „Ukázková odpověď (demo)“. Konverzace se ukládá do `localStorage` (klíče `fixit.chat.v1.<id>`,
  přístup je obalený v `try/catch`; tlačítko koše konverzaci smaže).

## Co je v demu simulované

- **Určení oboru** – jednoduchá pravidla (klíčová slova), žádná AI.
- **Řemeslníci a jejich data** – všichni jsou vymyšlení (jména, telefony `+420 777 000 1xx`,
  e-maily na `example.cz`, recenze, hodnocení, volné termíny, odznak „Ověřený“).
- **Odpovědi řemeslníků v chatu** – předpřipravené texty; zpráva nikam skutečně neodchází.
- **Termíny** – statické texty („zítra 8–12“), nejsou napojené na žádný kalendář.
- **Telefon a e-mail** – tlačítko „Zavolat“ a odkazy otevřou `tel:` / `mailto:` na vymyšlená čísla.

## Co by bylo potřeba pro ostrý provoz

1. **Databáze a účty** – nahradit `loadCraftsmen()` v `data.js` načtením z databáze
   (např. Supabase); přidat registraci řemeslníků a správu jejich profilů.
2. **Skutečné ověřování** – ověření totožnosti a živnostenského oprávnění (např. dotaz do
   živnostenského rejstříku) místo pevného příznaku `verified`.
3. **AI určení oboru** – nahradit `classifyProblem(text)` voláním modelu přes vlastní
   backend (API klíč nikdy v kódu prohlížeče). Zachovat tvar návratové hodnoty a bezpečnostní
   upozornění na plyn.
4. **Skutečný chat a notifikace** – zprávy přes backend (WebSocket / Supabase Realtime),
   e-mailové či SMS notifikace řemeslníkům, přihlášení zákazníka.
5. **Kalendář a rezervace** – skutečné volné termíny a potvrzování objednávek.
6. **Recenze** – recenze jen od ověřených zákazníků po dokončené zakázce, moderace.
7. **Geokódování** – pro vyšší provoz vlastní instance Nominatimu nebo placená služba
   (veřejný Nominatim je jen pro nízký provoz); dlaždice OSM nahradit vlastním poskytovatelem.
8. **Právní stránka** – obchodní podmínky, ochrana osobních údajů (GDPR), cookies.
9. **Obchodní model** – např. provize z objednávek nebo předplatné pro řemeslníky
   (téma předmětu Základy podnikání).

## Přístupnost

Viditelný focus, popisky polí, ovládání klávesnicí (dlaždice jsou radio tlačítka, okno chatu
zavře Esc a drží fokus uvnitř), alt texty u avatarů, kontrastní barvy z palety, respektování
`prefers-reduced-motion`.
