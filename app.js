/* ==========================================================================
   app.js – logika prototypu „Řemeslník na dosah“
   Čistý JavaScript bez build kroku. Závisí na data.js (CATEGORIES, TOWNS,
   loadCraftsmen) a na Leafletu (globální `L`).

   Obsah:
   1. Pomocné funkce
   2. classifyProblem – určení oboru z textu (později nahradí AI)
   3. geocode – adresa → souřadnice přes Nominatim
   4. distance – vzdálenost (haversine)
   5. Mapa (Leaflet)
   6. renderCards – vykreslení seznamu
   7. Chat (simulovaný, ukládá do localStorage)
   8. Formulář a přepínání obrazovek
   ========================================================================== */
'use strict';

const RADIUS_KM = 30;                    // poloměr hledání
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const CHAT_KEY_PREFIX = 'fixit.chat.v1.';

const state = {
  craftsmen: [],
  origin: null,        // { lat, lng, label }
  categoryId: 'jine',  // kategorie použitá pro hledání
  categoryAuto: true,  // true = určena z popisu, false = vybrána ručně
  problem: '',
  results: [],         // [{ ...craftsman, distanceKm }]
  outsideRadius: false,
  sort: 'nearest',
  selectedId: null,
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* ==========================================================================
   1. Pomocné funkce
   ========================================================================== */

/** Ochrana proti vložení HTML (data se vkládají přes innerHTML). */
function esc(value) {
  return String(value).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/** Malá písmena a odstranění diakritiky: „Kape KOHOUTEK, cítím“ → „kape kohoutek, citim“. */
function normalize(text) {
  return String(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** České skloňování podle počtu: plural(3, ['řemeslník', 'řemeslníci', 'řemeslníků']). */
function plural(n, [one, few, many]) {
  if (n === 1) return one;
  if (n >= 2 && n <= 4) return few;
  return many;
}

function formatKm(km) {
  return km.toLocaleString('cs-CZ', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '\u00a0km';
}

const categoryById = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];

function iconSvg(categoryId, size = 24) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${categoryById(categoryId).icon}</svg>`;
}

/** Úložiště odolné vůči zablokovanému localStorage (soukromý režim apod.). */
const memoryStore = {};
const storage = {
  get(key) {
    try { return localStorage.getItem(key); } catch (e) { return memoryStore[key] ?? null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { memoryStore[key] = value; }
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch (e) { delete memoryStore[key]; }
  },
};

/** Generovaný avatar z iniciál (SVG data URI) – žádné reálné fotky osob. */
const AVATAR_PALETTES = [
  ['#031927', '#9DD1F1'], ['#508AA8', '#031927'], ['#9DD1F1', '#031927'],
  ['#BA1200', '#FFFFFF'], ['#C8E0F4', '#031927'], ['#031927', '#C8E0F4'],
];
function avatarUri(name, seed = 0) {
  const initials = name.split(/[\s.]+/).filter(Boolean).map((s) => s[0]).slice(0, 2).join('').toUpperCase();
  const [bg, fg] = AVATAR_PALETTES[seed % AVATAR_PALETTES.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${bg}"/>` +
    `<text x="32" y="32" dy=".35em" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="26" font-weight="700" fill="${fg}">${initials}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/* ==========================================================================
   2. classifyProblem – určení oboru z textu
   --------------------------------------------------------------------------
   Jednoduchá pravidla: klíčová slova bez diakritiky, hledají se od začátku
   slova („zasuvk“ chytí zásuvka, zásuvky, zásuvku…). Vrací:
     { categoryId, score, gas }
   `gas` = text popisuje zápach / únik plynu (bezpečnostní upozornění).

   Tuto funkci později nahradí volání AI – stačí zachovat tvar návratové
   hodnoty (a může být asynchronní).
   ========================================================================== */
const KEYWORDS = {
  voda:     ['kohoutek', 'kohout', 'kape', 'tece', 'odpad', 'ucpan', 'ucpa', 'baterie', 'wc', 'zachod', 'umyvadl', 'vana', 'vane', 'sprch', 'potrubi', 'voda', 'vody', 'vodu', 'prosakuj', 'zatop', 'sifon', 'dres', 'bojler', 'splach', 'hadic', 'vodovod'],
  elektro:  ['zasuvk', 'jistic', 'proud', 'svetl', 'zarovk', 'lustr', 'elektr', 'vypinac', 'zkrat', 'kabel', 'rozvadec', 'vodic', 'jiskr', 'pojistk', 'vypadl', 'nabijec'],
  topeni:   ['kotel', 'kotle', 'radiator', 'topeni', 'topit', 'topi ', 'otopn', 'termostat', 'plyn', 'komin', 'podlahovk'],
  manzel:   ['police', 'policku', 'namontov', 'montaz', 'smontov', 'nabytek', 'skrin', 'zaves', 'pripevn', 'uvolnen', 'klik', 'ikea', 'kuchyn', 'drobn', 'opravit', 'vrzaj', 'dvirk'],
  malovani: ['malovani', 'malovat', 'vymalov', 'podlah', 'parket', 'lamino', 'vinyl', 'tapet', 'stena', 'steny', 'sten ', 'omitk', 'sadrokarton', 'natir', 'natre', 'strop'],
  strecha:  ['strech', 'strese', 'tasky', 'tasek', 'krytin', 'fasad', 'okap', 'zateka', 'zatek', 'izolac', 'klempir', 'lisejnik'],
  zahrada:  ['zahrad', 'strom', 'trav', 'sekac', 'sekat', 'zivy plot', 'plot', 'kacet', 'kaceni', 'orez', 'tuje', 'tuji', 'kos ', 'keri', 'zivopl'],
  zamecnik: ['zamek', 'zamk', 'zamyk', 'klic', 'dvere', 'dveri', 'zabouch', 'vlozk', 'zamcen', 'branka', 'brana', 'bezpecnostn'],
  klima:    ['klimatizac', 'klima', 'split', 'chlazeni', 'ochlaz', 'vzduchotechnik'],
};

/** Text popisuje zápach nebo únik plynu (plyn + slovo o zápachu / úniku). */
function detectGasLeak(normalized) {
  return /\bplyn/.test(normalized) &&
    /(\bcit|cuch|zapach|zapacha|smrd|smrad|pach|unik|syc|syk|zacpa|vonet|voni)/.test(normalized);
}

function classifyProblem(text) {
  const t = ' ' + normalize(text || '').replace(/[^a-z0-9]+/g, ' ') + ' ';
  const gas = detectGasLeak(t);
  let best = { categoryId: 'jine', score: 0 };

  for (const [categoryId, words] of Object.entries(KEYWORDS)) {
    let score = 0;
    for (const w of words) {
      // shoda jen od začátku slova, ať „plot“ nechytí „plotna“ uprostřed věty
      if (t.includes(' ' + w) || (w.includes(' ') && t.includes(w))) score += 1;
    }
    if (score > best.score) best = { categoryId, score };
  }
  if (gas) best = { categoryId: 'topeni', score: Math.max(best.score, 1) };
  return { ...best, gas };
}

/** Obsah bezpečnostního upozornění při zápachu plynu. */
function gasAlertHtml(compact = false) {
  return `
    <div class="gas-icon" aria-hidden="true">!</div>
    <div class="gas-body">
      <h2>Cítíte plyn? Nečekejte na řemeslníka!</h2>
      <ol>
        <li><strong>Zavřete hlavní uzávěr plynu.</strong></li>
        <li><strong>Vyvětrejte</strong> – otevřete okna a dveře.</li>
        <li>Nezapínejte světla ani spotřebiče, nepoužívejte oheň ani mobil v zaplyněné místnosti.</li>
        <li>Odejděte ven a volejte <a href="tel:1239">poruchovou linku plynu 1239</a> nebo <a href="tel:112">tísňovou linku 112</a>.</li>
      </ol>
      ${compact ? '' : '<p class="gas-note">Toto upozornění je obecná rada, nenahrazuje pokyny záchranných složek.</p>'}
    </div>`;
}

function toggleGasAlert(el, show, compact) {
  const newlyShown = show && el.hidden;
  if (newlyShown) el.innerHTML = gasAlertHtml(compact);
  el.hidden = !show;
  if (newlyShown && !compact) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

/* ==========================================================================
   3. geocode – adresa → souřadnice (Nominatim / OpenStreetMap)
   --------------------------------------------------------------------------
   Pravidla Nominatimu: max. 1 dotaz za sekundu (fronta níže), identifikace
   aplikace (prohlížeč sám posílá Referer; hlavičku User-Agent nelze z JS
   změnit, proto se posílá aspoň vlastní hlavička X-App), hledání omezeno
   na Česko. Vrací { lat, lng, label } nebo null; při chybě sítě vyhazuje.
   ========================================================================== */
let lastGeocodeAt = 0;
const geocodeCache = new Map();

async function geocode(address) {
  const key = normalize(address).trim();
  if (geocodeCache.has(key)) return geocodeCache.get(key);

  // dodržení limitu 1 dotaz / s
  const wait = lastGeocodeAt + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastGeocodeAt = Date.now();

  const params = new URLSearchParams({
    format: 'jsonv2', q: address, countrycodes: 'cz', limit: '1', 'accept-language': 'cs',
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${NOMINATIM_URL}?${params}`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json', 'X-App': 'remeslnik-na-dosah-skolni-demo' },
    });
    if (!res.ok) throw new Error('Nominatim HTTP ' + res.status);
    const data = await res.json();
    const hit = data[0];
    const result = hit ? { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon), label: hit.display_name } : null;
    geocodeCache.set(key, result);
    return result;
  } finally {
    clearTimeout(timer);
  }
}

/* ==========================================================================
   4. distance – vzdálenost vzdušnou čarou (vzorec haversine), v km
   ========================================================================== */
function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371; // poloměr Země v km
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/* ==========================================================================
   5. Mapa (Leaflet)
   ========================================================================== */
let map = null;
let mapLayer = null;
let mapBounds = null;
let mapNeedsFit = false;
const markers = new Map(); // id → L.marker

function ensureMap() {
  if (typeof L === 'undefined') {            // CDN nedostupné
    $('#map-fallback').hidden = false;
    return false;
  }
  $('#map-fallback').hidden = true;
  if (!map) {
    map = L.map('map', { zoomControl: true, attributionControl: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">přispěvatelé OpenStreetMap</a>',
    }).addTo(map);
    mapLayer = L.layerGroup().addTo(map);
  }
  return true;
}

function pinIcon(categoryId, selected) {
  return L.divIcon({
    className: 'pin-wrap',
    html: `<div class="pin${selected ? ' is-selected' : ''}">${iconSvg(categoryId, 18)}</div>`,
    iconSize: [38, 46], iconAnchor: [19, 44], popupAnchor: [0, -40],
  });
}

/** Vykreslí na mapu značku „Vy“, okruh a značky řemeslníků. */
function renderMap() {
  if (!ensureMap()) return;
  mapLayer.clearLayers();
  markers.clear();
  const { lat, lng } = state.origin;

  L.circle([lat, lng], {
    radius: RADIUS_KM * 1000, color: '#508AA8', weight: 2, dashArray: '6 8',
    fillColor: '#9DD1F1', fillOpacity: 0.12, interactive: false,
  }).addTo(mapLayer);

  const you = L.marker([lat, lng], {
    title: 'Vy – zadaná adresa', zIndexOffset: 2000,
    icon: L.divIcon({ className: 'pin-wrap', html: '<div class="you-pin">Vy</div>', iconSize: [44, 44], iconAnchor: [22, 22] }),
  }).addTo(mapLayer);
  you.bindPopup(`<strong>Vy</strong><br>${esc(state.origin.label)}`);

  const bounds = [[lat, lng]];
  state.results.forEach((c) => {
    const m = L.marker([c.lat, c.lng], { icon: pinIcon(c.category, false), title: `${c.name} – ${c.role}`, keyboard: true })
      .addTo(mapLayer);
    m.bindPopup(`<strong>${esc(c.name)}</strong><br>${esc(c.role)} · ${formatKm(c.distanceKm)}` +
      `<br><button type="button" class="popup-show" data-id="${c.id}">Zobrazit kartu</button>`);
    m.on('click', () => selectCraftsman(c.id, { fromMap: true }));
    m.on('add', () => m.getElement()?.setAttribute('aria-label', `${c.name}, ${c.role}, ${formatKm(c.distanceKm)}`));
    markers.set(c.id, m);
    bounds.push([c.lat, c.lng]);
  });

  if (!map.hasPopupHandler) {
    map.hasPopupHandler = true;
    map.on('popupopen', (ev) => {
      const btn = ev.popup.getElement()?.querySelector('.popup-show');
      if (!btn) return;
      btn.addEventListener('click', () => {
        setResultsTab('list');
        setTimeout(() => $(`#card-${btn.dataset.id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 60);
      });
    });
  }

  mapBounds = bounds;
  // Na mobilu je při prvním vykreslení mapa skrytá (má nulovou velikost) – přizpůsobíme ji až po zobrazení záložky.
  mapNeedsFit = true;
  if ($('#map').offsetWidth > 0) fitMap();
}

/** Přizpůsobí výřez mapy adrese a značkám. */
function fitMap() {
  if (!map || !mapBounds) return;
  map.invalidateSize();
  if (mapBounds.length > 1) map.fitBounds(mapBounds, { padding: [48, 48], maxZoom: 13 });
  else map.setView(mapBounds[0], 12);
  mapNeedsFit = false;
}

/* ==========================================================================
   6. renderCards – seznam řemeslníků
   ========================================================================== */
function sortResults(list, mode) {
  const copy = [...list];
  if (mode === 'rating') copy.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount || a.distanceKm - b.distanceKm);
  else if (mode === 'soonest') copy.sort((a, b) => a.availability.days - b.availability.days || a.distanceKm - b.distanceKm);
  else copy.sort((a, b) => a.distanceKm - b.distanceKm);
  return copy;
}

/** Hvězdičky: dvě vrstvy, horní se ořízne podle průměru. */
function starsHtml(rating) {
  const pct = Math.round((rating / 5) * 100);
  const star = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path d="M12 2.5l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.6 5.9 21.1l1.4-6.8L2.2 9.6l6.9-.8z"/></svg>';
  const row = star.repeat(5);
  return `<span class="stars" role="img" aria-label="Hodnocení ${rating.toLocaleString('cs-CZ')} z 5">` +
    `<span class="stars-bg">${row}</span><span class="stars-fg" style="width:${pct}%">${row}</span></span>`;
}

/** „Nejbližší termín: zítra 8–12“ / „Volno od pondělí“. */
function availabilityHtml(av) {
  const text = av.text.charAt(0).toUpperCase() + av.text.slice(1);
  return av.text.startsWith('volno') ? `<span><strong>${esc(text)}</strong></span>` : `<span>Nejbližší termín: <strong>${esc(av.text)}</strong></span>`;
}

/** Vykreslí karty řemeslníků podle aktuálního řazení do #cards. */
function renderCards() {
  const box = $('#cards');
  const list = sortResults(state.results, state.sort);

  if (!list.length) {
    box.innerHTML = '<p class="empty">V okolí jsme nikoho nenašli. Zkuste změnit hledání.</p>';
    return;
  }

  box.innerHTML = list.map((c) => {
    const idx = parseInt(c.id.replace(/\D/g, ''), 10) || 0;
    const reviews = `${c.reviewCount} ${plural(c.reviewCount, ['recenze', 'recenze', 'recenzí'])}`;
    const verified = c.verified ? `
      <span class="badge" tabindex="0" aria-describedby="tip-${c.id}">
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Ověřený
        <span class="tooltip" role="tooltip" id="tip-${c.id}">Totožnost a živnostenské oprávnění ověřeny</span>
      </span>` : '';
    return `
    <article class="card${c.id === state.selectedId ? ' is-selected' : ''}" id="card-${c.id}" data-id="${c.id}" aria-labelledby="name-${c.id}">
      <div class="card-top">
        <img class="avatar" src="${avatarUri(c.name, idx)}" width="56" height="56" alt="Avatar z iniciálů: ${esc(c.name)}">
        <div class="card-id">
          <h3 id="name-${c.id}">${esc(c.name)}</h3>
          <p class="role">${iconSvg(c.category, 16)} ${esc(c.role)}</p>
          ${verified}
        </div>
        <div class="distance"><strong>${formatKm(c.distanceKm)}</strong><small>${esc(c.town)}</small></div>
      </div>
      <p class="desc">${esc(c.description)}</p>
      <div class="rating">
        ${starsHtml(c.rating)}
        <strong>${c.rating.toLocaleString('cs-CZ', { minimumFractionDigits: 1 })}</strong>
        <span class="muted">(${reviews})</span>
      </div>
      <blockquote class="review">
        <p>„${esc(c.review.text)}“</p>
        <footer>– ${esc(c.review.author)}, ${'★'.repeat(c.review.stars)}<span class="sr-only"> ${c.review.stars} z 5</span></footer>
      </blockquote>
      <p class="avail"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>
        ${availabilityHtml(c.availability)}</p>
      <ul class="contact">
        <li><a href="tel:${c.phone.replace(/\s/g, '')}">${esc(c.phone)}</a></li>
        <li><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></li>
      </ul>
      <div class="actions">
        <button type="button" class="btn btn-primary" data-act="chat" data-id="${c.id}">Napsat zprávu</button>
        <a class="btn btn-secondary" href="tel:${c.phone.replace(/\s/g, '')}">Zavolat</a>
      </div>
    </article>`;
  }).join('');
}

/** Souhrn nad seznamem: „Rozpoznali jsme: instalatér · 6 řemeslníků do 30 km“. */
function renderSummary() {
  const cat = categoryById(state.categoryId);
  const n = state.results.length;
  const prefix = state.categoryAuto ? 'Rozpoznali jsme' : 'Vybrali jste';
  const count = state.outsideRadius
    ? `žádný řemeslník do ${RADIUS_KM}\u00a0km, ukazujeme ${n} nejbližší`
    : `${n} ${plural(n, ['řemeslník', 'řemeslníci', 'řemeslníků'])} do ${RADIUS_KM}\u00a0km`;
  const extra = state.categoryId === 'jine' ? ' (obor jsme neurčili, ukazujeme všechny)' : '';
  $('#summary').innerHTML = `${prefix}: <strong>${esc(cat.trade)}</strong>${extra} · ${count}`;
  $('#tab-count').textContent = n ? `(${n})` : '';
}

/** Vybere řemeslníka: zvýrazní kartu i značku. */
function selectCraftsman(id, { fromMap = false, fromCard = false } = {}) {
  state.selectedId = id;
  $$('.card').forEach((el) => el.classList.toggle('is-selected', el.dataset.id === id));
  markers.forEach((m, mid) => {
    // třídu měníme na existujícím prvku (setIcon by zahodil zaostření z klávesnice)
    m.getElement()?.querySelector('.pin')?.classList.toggle('is-selected', mid === id);
    m.setZIndexOffset(mid === id ? 1000 : 0);
  });
  const marker = markers.get(id);
  if (marker && fromCard) {
    map.panTo(marker.getLatLng(), { animate: true });
    marker.openPopup();
  }
  if (fromMap) {
    const card = $(`#card-${id}`);
    if (card) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

/* ==========================================================================
   7. Chat – simulovaný, konverzace v localStorage
   ========================================================================== */
const chat = { id: null, opener: null, timers: {} };

const SIMULATED_REPLIES = [
  (c) => `Dobrý den, píše vám ${c.name} – děkuji za zprávu. K vaší adrese to mám ${formatKm(c.distanceKm)}. ${c.availability.days === 0 ? 'Mohu dorazit ještě dnes' : 'Nejbližší termín mám ' + c.availability.text}. Hodí se vám to?`,
  () => 'Rozumím. Pošlete mi prosím, pokud můžete, fotku problému, ať se na to můžu předem připravit.',
  () => 'Orientační cena je 550–750 Kč za hodinu práce plus materiál, přesnější nabídku udělám na místě.',
  () => 'Platí, ozvu se den předem telefonicky. Děkuji!',
];

function chatKey(id) { return CHAT_KEY_PREFIX + id; }

function loadChat(id) {
  try {
    const raw = storage.get(chatKey(id));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) { return []; }
}
function saveChat(id, messages) { storage.set(chatKey(id), JSON.stringify(messages)); }

function timeLabel(ts) {
  return new Date(ts).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
}

function renderChat(typing = false) {
  const c = state.results.find((r) => r.id === chat.id);
  const log = $('#chat-log');
  const messages = loadChat(chat.id);
  log.innerHTML = messages.map((m) => `
    <div class="msg ${m.from === 'me' ? 'msg-me' : 'msg-them'}">
      <div class="bubble">${esc(m.text).replace(/\n/g, '<br>')}</div>
      <div class="meta">${m.demo ? '<span class="demo-tag">Ukázková odpověď (demo)</span> ' : ''}${esc(m.from === 'me' ? 'Vy' : c.name)} · ${timeLabel(m.ts)}</div>
    </div>`).join('') +
    (typing ? `<div class="msg msg-them"><div class="bubble typing" aria-label="${esc(c.name)} píše"><span></span><span></span><span></span></div></div>` : '');
  log.scrollTop = log.scrollHeight;
}

/** Přidá zprávu do uložené konverzace. */
function pushMessage(id, from, text, demo = false) {
  const messages = loadChat(id);
  messages.push({ from, text, ts: Date.now(), demo });
  saveChat(id, messages);
}

/** Po chvíli „odpoví“ řemeslník – ukázková odpověď, jasně označená jako demo. */
function scheduleReply(id) {
  clearTimeout(chat.timers[id]);
  if (chat.id === id) renderChat(true);
  const c = state.results.find((r) => r.id === id);
  chat.timers[id] = setTimeout(() => {
    const repliesSoFar = loadChat(id).filter((m) => m.from === 'them').length;
    const reply = SIMULATED_REPLIES[Math.min(repliesSoFar, SIMULATED_REPLIES.length - 1)](c);
    pushMessage(id, 'them', reply, true);
    if (chat.id === id) renderChat(false);
  }, 1400 + Math.random() * 900);
}

function openChat(id, opener) {
  const c = state.results.find((r) => r.id === id);
  if (!c) return;
  chat.id = id;
  chat.opener = opener || document.activeElement;
  $('#chat-avatar').src = avatarUri(c.name, parseInt(c.id.replace(/\D/g, ''), 10) || 0);
  $('#chat-avatar').alt = `Avatar z iniciálů: ${c.name}`;
  $('#chat-title').textContent = c.name;
  $('#chat-role').textContent = `${c.role} · ${c.town}`;

  // První zpráva = popis problému (jen u nové konverzace)
  if (!loadChat(id).length) {
    const cat = categoryById(state.categoryId);
    const first = state.problem || `Dobrý den, hledám pomoc: ${cat.label.toLowerCase()}.`;
    pushMessage(id, 'me', first);
    scheduleReply(id);
  }
  renderChat();
  $('#chat').hidden = false;
  document.body.classList.add('modal-open');
  $('#chat-input').focus();
}

function closeChat() {
  $('#chat').hidden = true;
  document.body.classList.remove('modal-open');
  // Čekající simulovaná odpověď se doručí do uložené konverzace i po zavření okna.
  const opener = chat.opener;
  chat.id = null;
  if (opener && document.contains(opener)) opener.focus();
}

function initChat() {
  $('#chat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#chat-input');
    const text = input.value.trim();
    if (!text || !chat.id) return;
    pushMessage(chat.id, 'me', text);
    input.value = '';
    input.style.height = '';
    scheduleReply(chat.id);
    input.focus();
  });
  // Enter odešle, Shift+Enter nový řádek
  $('#chat-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      $('#chat-form').requestSubmit();
    }
  });
  $('#chat-input').addEventListener('input', (e) => {
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  });
  $('#chat-clear').addEventListener('click', () => {
    if (!chat.id) return;
    clearTimeout(chat.timers[chat.id]);
    storage.remove(chatKey(chat.id));
    renderChat();
    $('#chat-input').focus();
  });
  $$('#chat [data-close]').forEach((el) => el.addEventListener('click', closeChat));

  // Esc zavře okno, Tab zůstává uvnitř okna
  document.addEventListener('keydown', (e) => {
    if ($('#chat').hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); closeChat(); return; }
    if (e.key !== 'Tab') return;
    const focusable = $$('#chat button, #chat textarea, #chat [href]').filter((el) => !el.disabled && el.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
}

/* ==========================================================================
   8. Formulář a přepínání obrazovek
   ========================================================================== */
function renderTiles() {
  $('#category-tiles').innerHTML = CATEGORIES.map((c) => `
    <label class="tile">
      <input type="radio" name="category" value="${c.id}">
      <span class="tile-box">
        <span class="tile-icon">${iconSvg(c.id, 28)}</span>
        <span class="tile-label">${esc(c.label)}</span>
      </span>
    </label>`).join('');
}

function selectedCategory() {
  const el = $('input[name="category"]:checked');
  return el ? el.value : null;
}

/** Průběžná nápověda pod popisem: tip oboru + upozornění na plyn. */
function updateProblemHint() {
  const text = $('#problem').value;
  const cls = classifyProblem(text);
  toggleGasAlert($('#gas-alert-form'), cls.gas, false);
  const hint = $('#problem-hint');
  if (!selectedCategory() && cls.score > 0) hint.textContent = `Zdá se, že hledáte: ${categoryById(cls.categoryId).label}.`;
  else hint.textContent = '';
}

function showError(id, msg) {
  const el = $(id);
  el.textContent = msg;
  el.hidden = !msg;
}

function setBusy(busy) {
  const btn = $('#submit-btn');
  btn.disabled = busy;
  btn.classList.toggle('is-busy', busy);
  $('.btn-label', btn).textContent = busy ? 'Hledám adresu…' : 'Najít řemeslníky';
}

/** Zobrazí nouzový výběr obce (adresu se nepodařilo najít). */
function showTownFallback(address, networkError) {
  const sel = $('#town-select');
  if (!sel.options.length) {
    sel.innerHTML = TOWNS.map((t, i) => `<option value="${i}">${esc(t.name)}</option>`).join('');
  }
  // předvybereme obec, která je v zadané adrese uvedena
  const na = normalize(address);
  const idx = TOWNS.findIndex((t) => na.includes(normalize(t.name)));
  if (idx >= 0) sel.value = String(idx);
  $('#town-fallback-msg').innerHTML = networkError
    ? '<strong>Vyhledání adresy se nepodařilo (chyba připojení).</strong> Vyberte nejbližší obec a hledání s ní dokončíme.'
    : '<strong>Adresu se nepodařilo najít.</strong> Vyberte nejbližší obec a hledání s ní dokončíme.';
  $('#town-fallback').hidden = false;
  sel.focus();
}

async function onSubmit(e) {
  e.preventDefault();
  const address = $('#address').value.trim();
  const problem = $('#problem').value.trim();
  $('#town-fallback').hidden = true;

  // Validace
  showError('#address-error', address ? '' : 'Zadejte prosím adresu (obec a ulici).');
  const missingProblem = !problem && !selectedCategory();
  showError('#problem-error', missingProblem ? 'Popište problém nebo vyberte kategorii.' : '');
  if (!address) { $('#address').focus(); return; }
  if (missingProblem) { $('#problem').focus(); return; }

  setBusy(true);
  let geo = null;
  let networkError = false;
  try {
    geo = await geocode(address);
  } catch (err) {
    networkError = true;
    console.warn('Geokódování selhalo:', err);
  }
  setBusy(false);

  if (!geo) { showTownFallback(address, networkError); return; }
  startSearch({ lat: geo.lat, lng: geo.lng, label: geo.label.split(',').slice(0, 3).join(',').trim() });
}

function onTownContinue() {
  const town = TOWNS[parseInt($('#town-select').value, 10)];
  $('#town-fallback').hidden = true;
  startSearch({ lat: town.lat, lng: town.lng, label: `${town.name} (střed obce)` });
}

/** Spočítá výsledky a přepne na obrazovku s mapou a seznamem. */
function startSearch(origin) {
  const problem = $('#problem').value.trim();
  const chosen = selectedCategory();
  const cls = classifyProblem(problem);

  state.origin = origin;
  state.problem = problem;
  state.categoryAuto = !chosen;
  state.categoryId = chosen || cls.categoryId;
  state.selectedId = null;

  const pool = state.categoryId === 'jine'
    ? state.craftsmen
    : state.craftsmen.filter((c) => c.category === state.categoryId);
  const all = pool
    .map((c) => ({ ...c, distanceKm: distanceKm(origin.lat, origin.lng, c.lat, c.lng) }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
  let found = all.filter((c) => c.distanceKm <= RADIUS_KM);
  state.outsideRadius = found.length === 0 && all.length > 0;
  if (state.outsideRadius) found = all.slice(0, 5);
  state.results = found;

  toggleGasAlert($('#gas-alert-results'), cls.gas, true);
  renderSummary();
  showScreen('results');
  renderCards();
  renderMap();
  setResultsTab('list');
}

function showScreen(name) {
  const results = name === 'results';
  $('#screen-form').hidden = results;
  $('#screen-results').hidden = !results;
  document.body.classList.toggle('is-results', results);
  window.scrollTo(0, 0);
  if (results) {
    $('#summary').focus({ preventScroll: true });
    if (map) map.invalidateSize();
  } else {
    $('#main').focus({ preventScroll: true });
  }
}

/** Mobilní záložky Seznam / Mapa. Na desktopu jsou obě části vidět současně. */
function setResultsTab(tab) {
  $('#results').dataset.tab = tab;
  $$('.mobile-tabs [role="tab"]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  if (tab === 'map' && map) {
    map.invalidateSize();
    if (mapNeedsFit) fitMap();
  }
}

function init() {
  renderTiles();

  // Výběr kategorie
  $('#category-tiles').addEventListener('change', () => {
    $('#clear-category').hidden = !selectedCategory();
    updateProblemHint();
  });
  $('#clear-category').addEventListener('click', () => {
    const el = $('input[name="category"]:checked');
    if (el) el.checked = false;
    $('#clear-category').hidden = true;
    updateProblemHint();
  });

  // Příklady popisu
  $$('.chip[data-example]').forEach((chip) => chip.addEventListener('click', () => {
    $('#problem').value = chip.dataset.example;
    showError('#problem-error', '');
    updateProblemHint();
    $('#problem').focus();
  }));
  $('#problem').addEventListener('input', () => { showError('#problem-error', ''); updateProblemHint(); });
  $('#address').addEventListener('input', () => { showError('#address-error', ''); $('#town-fallback').hidden = true; });

  $('#search-form').addEventListener('submit', onSubmit);
  $('#town-continue').addEventListener('click', onTownContinue);

  // Výsledky
  $$('[data-action="back"]').forEach((b) => b.addEventListener('click', () => {
    showScreen('form');
    $('#address').focus();
  }));
  $('#sort-select').addEventListener('change', (e) => { state.sort = e.target.value; renderCards(); });
  $$('.mobile-tabs [role="tab"]').forEach((b) => b.addEventListener('click', () => setResultsTab(b.dataset.tab)));

  // Delegace kliků v seznamu: chat, nebo výběr karty
  $('#cards').addEventListener('click', (e) => {
    const chatBtn = e.target.closest('[data-act="chat"]');
    if (chatBtn) { openChat(chatBtn.dataset.id, chatBtn); return; }
    if (e.target.closest('a, button')) return;
    const card = e.target.closest('.card');
    if (card) selectCraftsman(card.dataset.id, { fromCard: true });
  });
  // po zaostření klávesnicí na kartu (tlačítko uvnitř) kartu také zvýrazníme
  $('#cards').addEventListener('focusin', (e) => {
    const card = e.target.closest('.card');
    if (card && card.dataset.id !== state.selectedId) selectCraftsman(card.dataset.id);
  });

  initChat();

  loadCraftsmen()
    .then((data) => { state.craftsmen = data; })
    .catch((err) => {
      console.error('Nepodařilo se načíst řemeslníky:', err);
      showError('#problem-error', 'Data řemeslníků se nepodařilo načíst. Zkuste stránku obnovit.');
    });
}

document.addEventListener('DOMContentLoaded', init);
