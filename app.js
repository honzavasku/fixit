/* ==========================================================================
   app.js – FixIt: role, hashové routování, vyhledávání, výsledky, chat
   Závisí na: config.js, util.js, data.js, maps.js, categories.js,
   availability.js, address-input.js, data-source.js, auth.js, pages.js
   (a na Leafletu – globální `L`).

   Routy (hash, kvůli GitHub Pages bez přesměrování):
     #/                         úvod a vyhledávání (u řemeslníka rozcestník)
     #/hledat?kat=&lat=&lng=&a=&q=   výsledky
     #/poplatky   #/profil   #/registrace-remeslnika
   ========================================================================== */
'use strict';

const RADIUS_KM = 30;               // poloměr hledání
const ROLE_KEY = 'role';            // localStorage: fixit:role
const ROLES = ['client', 'craftsman', 'guest'];

const state = {
  ds: null,
  data: { categories: [], priceGuides: [], craftsmen: [] },
  favorites: new Set(),
  origin: null,        // { lat, lng, label }
  categoryId: null,    // kategorie použitá pro hledání (null = všechny obory)
  categoryAuto: true,  // true = určena z popisu, false = vybrána ručně
  problem: '',
  results: [],         // [{ ...craftsman, distanceKm, next }]
  outsideRadius: false,
  sort: 'nearest',
  onlyToday: false,
  selectedId: null,
};

/* ==========================================================================
   Role (klient / řemeslník / jen se dívám) – uložená v localStorage
   ========================================================================== */
const Roles = {
  get() { const r = storage.get(ROLE_KEY); return ROLES.includes(r) ? r : null; },
  set(r) { storage.set(ROLE_KEY, r); },
};

const NAV = {
  client: [
    { href: '#/', label: 'Najít řemeslníka', paths: ['/', '/hledat'] },
  ],
  craftsman: [
    { href: '#/registrace-remeslnika', label: 'Registrace řemeslníka', paths: ['/registrace-remeslnika'] },
    { href: '#/profil', label: 'Můj profil', paths: ['/profil'] },
    { href: '#/poplatky', label: 'Ceník poplatků', paths: ['/poplatky'] },
  ],
};

function applyRole() {
  const role = Roles.get();
  document.body.className = document.body.className.replace(/\brole-\w+/g, '').trim();
  document.body.classList.add('role-' + (role || 'unknown'));
  $('#role-select').value = role || 'client';

  const items = role === 'craftsman' ? NAV.craftsman : [...NAV.client];
  if (role !== 'craftsman' && Auth.user()) items.push({ href: '#/profil', label: 'Můj účet', paths: ['/profil'] });
  const path = parseHash().path;
  $('#main-nav').innerHTML = items.map((i) =>
    `<a href="${i.href}"${i.paths.includes(path) ? ' aria-current="page"' : ''}>${esc(i.label)}</a>`).join('');
}

function showRoleModal() {
  const modal = $('#role-modal');
  if (!modal.hidden) return;
  Modal.open(modal, {
    opener: document.body,
    onClose: () => { if (!Roles.get()) { Roles.set('guest'); applyRole(); route(); } },
  });
}

function chooseRole(role) {
  Roles.set(role);
  const modal = $('#role-modal');
  if (!modal.hidden) Modal.close(modal);
  applyRole();
  // řemeslník má rozcestník, klient vyhledávání
  if (['/', '/hledat'].includes(parseHash().path)) navigate('#/'); else route();
}

/* ==========================================================================
   Router
   ========================================================================== */
const VIEWS = { '/': 'home', '/hledat': 'results', '/poplatky': 'fees', '/profil': 'profile', '/registrace-remeslnika': 'register' };
const TITLES = {
  home: 'FixIt – řemeslník na dosah', pro: 'FixIt – pro řemeslníky', results: 'Výsledky hledání – FixIt',
  fees: 'Ceník poplatků – FixIt', profile: 'Můj profil – FixIt', register: 'Registrace řemeslníka – FixIt',
};

function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  return { path: path || '/', params: new URLSearchParams(qs || '') };
}

function navigate(hash) {
  if (location.hash === hash) route(); else location.hash = hash;
}

let routeToken = 0;
async function route() {
  const token = ++routeToken;
  const { path, params } = parseHash();
  let view = VIEWS[path];
  if (!view) { location.replace('#/'); return; }
  if (view === 'home' && Roles.get() === 'craftsman') view = 'pro';

  $$('main > [data-view]').forEach((s) => { s.hidden = s.dataset.view !== view; });
  document.body.classList.toggle('is-results', view === 'results');
  document.title = TITLES[view];
  applyRole();

  const ctx = pageContext();
  if (view === 'results') {
    if (!runSearchFromParams(params)) { location.replace('#/'); return; }
  } else if (view === 'fees') Pages.fees($('#view-fees'));
  else if (view === 'pro') Pages.craftsmanHome($('#view-pro'));
  else if (view === 'profile') await Pages.profile($('#view-profile'), ctx);
  else if (view === 'register') await Pages.register($('#view-register'), ctx);
  if (token !== routeToken) return;

  if (view !== 'results') window.scrollTo(0, 0);
  if (view === 'results') {
    $('#summary').focus({ preventScroll: true });
    if (map) map.invalidateSize();
  } else {
    $('#main').focus({ preventScroll: true });
  }
}

/* ==========================================================================
   Zdroj dat, přihlášení → stav aplikace
   ========================================================================== */
async function reloadData() {
  const all = await state.ds.loadAll();
  state.data.craftsmen = all.craftsmen;
}

async function loadFavorites() {
  const u = Auth.user();
  try { state.favorites = u ? await state.ds.favorites.list(u.id) : new Set(); }
  catch (e) { console.warn('Oblíbené:', e); state.favorites = new Set(); }
}

async function toggleFavorite(id) {
  const u = Auth.user();
  if (!u) return;
  const on = !state.favorites.has(id);
  try {
    await state.ds.favorites.set(u.id, id, on);
    if (on) state.favorites.add(id); else state.favorites.delete(id);
    $$(`[data-act="fav"][data-id="${CSS.escape(id)}"]`).forEach((b) => paintFav(b, on));
    toast(on ? 'Přidáno do oblíbených.' : 'Odebráno z oblíbených.');
  } catch (e) {
    console.warn(e);
    toast(e.userMessage || 'Oblíbené se nepodařilo uložit.', 'error');
  }
}

function pageContext() {
  return {
    ds: state.ds,
    craftsmen: () => state.data.craftsmen,
    favorites: () => state.favorites,
    reload: reloadData,
    navigate,
    openChat: (c, opener) => openChat(c, opener),
    toggleFavorite,
    refreshUser: () => Auth.refresh(),
  };
}

let lastIdentity = null;
async function onAuthChange(user, event) {
  const identity = user ? `${user.id}|${user.role}` : '';
  if (identity === lastIdentity) return;           // např. obnovení tokenu – nic nepřekreslujeme
  lastIdentity = identity;
  if (user && ROLES.includes(user.role)) Roles.set(user.role);   // role účtu přebírá volbu v záhlaví
  await loadFavorites();
  if (user) { try { await reloadData(); } catch (e) { console.warn(e); } }
  applyRole();
  route();
}

/* ==========================================================================
   Domovská obrazovka: kategorie, adresa, popis
   ========================================================================== */
let addressInput = null;

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

/** Průběžná nápověda pod popisem: tip oboru + upozornění na plyn. */
function updateProblemHint() {
  const cls = classifyProblem($('#problem').value);
  toggleGasAlert($('#gas-alert-form'), cls.gas, false);
  const hint = $('#problem-hint');
  if (!CategoryPicker.getSelected() && cls.categoryId) hint.textContent = `Zdá se, že hledáte: ${Tree.pathNames(cls.categoryId)}.`;
  else hint.textContent = '';
}

/** Zobrazí nouzový výběr obce (adresu se nepodařilo najít). */
function showTownFallback(address, message) {
  const sel = $('#town-select');
  if (!sel.options.length) sel.innerHTML = TOWNS.map((t, i) => `<option value="${i}">${esc(t.name)}</option>`).join('');
  const na = normalize(address);
  const idx = TOWNS.findIndex((t) => na.includes(normalize(t.name)));
  if (idx >= 0) sel.value = String(idx);
  $('#town-fallback-msg').innerHTML = `<strong>${esc(message)}</strong> Vyberte nejbližší obec a hledání s ní dokončíme.`;
  $('#town-fallback').hidden = false;
  sel.focus();
}

async function onSubmit(e) {
  e.preventDefault();
  const address = $('#address').value.trim();
  const problem = $('#problem').value.trim();
  $('#town-fallback').hidden = true;

  showError('#address-error', address ? '' : 'Zadejte prosím adresu (obec a ulici).');
  const missingProblem = !problem && !CategoryPicker.getSelected();
  showError('#problem-error', missingProblem ? 'Popište problém nebo vyberte obor.' : '');
  if (!address) { $('#address').focus(); return; }
  if (missingProblem) { $('#problem').focus(); return; }

  let geo = addressInput.getPicked();          // vybráno z našeptávače – geokódovat netřeba
  if (!geo) {
    setBusy(true);
    try {
      geo = await Maps.geocode(address);
    } catch (err) {
      console.warn('Geokódování selhalo:', err);
      setBusy(false);
      showTownFallback(address, err instanceof MapsError ? err.userMessage : 'Vyhledání adresy se nepodařilo.');
      return;
    }
    setBusy(false);
    if (!geo) { showTownFallback(address, 'Adresu se nepodařilo najít.'); return; }
  }
  goSearch({ lat: geo.lat, lng: geo.lng, label: geo.label.split(',').slice(0, 3).join(',').trim() });
}

function onTownContinue() {
  const town = TOWNS[parseInt($('#town-select').value, 10)];
  $('#town-fallback').hidden = true;
  goSearch({ lat: town.lat, lng: town.lng, label: `${town.name} (střed obce)` });
}

/** Přejde na #/hledat; parametry v URL umožní obnovit stránku i tlačítko Zpět. */
function goSearch(origin) {
  const p = new URLSearchParams({ lat: origin.lat.toFixed(5), lng: origin.lng.toFixed(5), a: origin.label, q: $('#problem').value.trim() });
  const cat = CategoryPicker.getSelected();
  if (cat) p.set('kat', cat);
  navigate('#/hledat?' + p);
}

/* ==========================================================================
   Vyhledávání a výsledky
   ========================================================================== */
function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371; // poloměr Země v km
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Spočítá výsledky z parametrů v URL. Vrací false, když parametry nejsou platné. */
function runSearchFromParams(params) {
  const lat = parseFloat(params.get('lat'));
  const lng = parseFloat(params.get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  const origin = { lat, lng, label: params.get('a') || 'zadaná poloha' };
  const problem = params.get('q') || '';
  const chosen = params.get('kat');
  const cls = classifyProblem(problem);

  state.origin = origin;
  state.problem = problem;
  state.categoryAuto = !(chosen && Tree.get(chosen));
  state.categoryId = state.categoryAuto ? cls.categoryId : chosen;
  state.selectedId = null;

  const now = new Date();
  const pool = state.categoryId
    ? state.data.craftsmen.filter((c) => Tree.covers(c.categoryIds, state.categoryId))
    : state.data.craftsmen;
  const all = pool
    .map((c) => ({ ...c, distanceKm: distanceKm(origin.lat, origin.lng, c.lat, c.lng), next: nextAvailability(c, now) }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
  let found = all.filter((c) => c.distanceKm <= RADIUS_KM);
  state.outsideRadius = found.length === 0 && all.length > 0;
  if (state.outsideRadius) found = all.slice(0, 5);
  state.results = found;

  toggleGasAlert($('#gas-alert-results'), cls.gas, true);
  $('#estimate').innerHTML = Prices.html(state.categoryId);
  renderResults();
  setResultsTab('list');
  return true;
}

function visibleResults() {
  const list = state.onlyToday ? state.results.filter((c) => c.next.today) : state.results;
  const copy = [...list];
  if (state.sort === 'rating') copy.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || b.reviewCount - a.reviewCount || a.distanceKm - b.distanceKm);
  else if (state.sort === 'soonest') copy.sort((a, b) => a.next.minutesFromNow - b.next.minutesFromNow || a.distanceKm - b.distanceKm);
  else copy.sort((a, b) => a.distanceKm - b.distanceKm);
  return copy;
}

function renderResults() {
  renderSummary();
  renderCards();
  renderMap();
}

/** Souhrn nad seznamem: „Rozpoznali jsme: Dům a byt › Voda a odpady · 6 řemeslníků do 30 km“. */
function renderSummary() {
  const n = visibleResults().length;
  const prefix = state.categoryAuto ? 'Rozpoznali jsme' : 'Vybrali jste';
  const what = state.categoryId
    ? `<strong>${esc(Tree.pathNames(state.categoryId))}</strong>`
    : '<strong>obor jsme neurčili</strong>, ukazujeme všechny';
  const count = state.outsideRadius
    ? `žádný řemeslník do ${RADIUS_KM} km, ukazujeme ${n} nejbližší`
    : `${n} ${plural(n, ['řemeslník', 'řemeslníci', 'řemeslníků'])} do ${RADIUS_KM} km`;
  const filter = state.onlyToday ? ' · jen volní dnes' : '';
  $('#summary').innerHTML = `${prefix}: ${what} · ${count}${filter}`;
  $('#tab-count').textContent = n ? `(${n})` : '';
  const today = state.results.filter((c) => c.next.today).length;
  $('#today-count').textContent = `(${today})`;
}

/** Hvězdičky: dvě vrstvy, horní se ořízne podle průměru. */
function starsHtml(rating) {
  const pct = Math.round((rating / 5) * 100);
  const star = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path d="M12 2.5l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.6 5.9 21.1l1.4-6.8L2.2 9.6l6.9-.8z"/></svg>';
  const row = star.repeat(5);
  return `<span class="stars" role="img" aria-label="Hodnocení ${rating.toLocaleString('cs-CZ')} z 5">` +
    `<span class="stars-bg">${row}</span><span class="stars-fg" style="width:${pct}%">${row}</span></span>`;
}

const HEART = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M12 20s-7-4.4-9-9.2C1.8 7.6 3.6 4.5 6.8 4.5c2 0 3.6 1.1 5.2 3 1.6-1.9 3.2-3 5.2-3 3.2 0 5 3.1 3.8 6.3C19 15.6 12 20 12 20z" stroke-width="1.8" stroke-linejoin="round"/></svg>';
const LOCK = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';

function paintFav(btn, on) {
  btn.setAttribute('aria-pressed', String(on));
  const name = btn.dataset.name || '';
  btn.setAttribute('aria-label', on ? `Odebrat ${name} z oblíbených` : `Přidat ${name} do oblíbených`);
}

function cardHtml(c) {
  const phoneHref = c.phone ? 'tel:' + c.phone.replace(/\s/g, '') : '';
  const catIcon = Tree.get(c.categoryIds[0])?.icon || 'generic';
  const fav = state.favorites.has(c.id);
  const verified = c.verified ? `
      <span class="badge" tabindex="0" aria-describedby="tip-${esc(c.id)}">
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Ověřený
        <span class="tooltip" role="tooltip" id="tip-${esc(c.id)}">Totožnost a živnostenské oprávnění ověřeny</span>
      </span>` : '';
  const rating = c.rating != null ? `
      <div class="rating">
        ${starsHtml(c.rating)}
        <strong>${c.rating.toLocaleString('cs-CZ', { minimumFractionDigits: 1 })}</strong>
        <span class="muted">(${c.reviewCount} ${plural(c.reviewCount, ['recenze', 'recenze', 'recenzí'])})</span>
      </div>` : '<div class="rating"><span class="muted">Zatím bez hodnocení</span></div>';
  const review = c.review ? `
      <blockquote class="review">
        <p>„${esc(c.review.text)}“</p>
        <footer>– ${esc(c.review.author)}, ${'★'.repeat(c.review.stars)}<span class="sr-only"> ${c.review.stars} z 5</span></footer>
      </blockquote>` : '';
  const contact = c.phone || c.email
    ? `<ul class="contact">
        ${c.phone ? `<li><a href="${esc(phoneHref)}">${esc(c.phone)}</a></li>` : ''}
        ${c.email ? `<li><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></li>` : ''}
      </ul>`
    : `<p class="contact locked">${LOCK} Kontakt se odemyká za 100 Kč (návrh, viz <a href="#/poplatky">poplatky</a>)</p>`;

  return `
    <article class="card${c.id === state.selectedId ? ' is-selected' : ''}" id="card-${esc(c.id)}" data-id="${esc(c.id)}" aria-labelledby="name-${esc(c.id)}">
      <div class="card-top">
        <img class="avatar" src="${avatarUri(c.name, c.id)}" width="56" height="56" alt="Avatar z iniciálů: ${esc(c.name)}">
        <div class="card-id">
          <h3 id="name-${esc(c.id)}">${esc(c.name)}</h3>
          <p class="role">${iconSvg(catIcon, 16)} ${esc(c.role)}</p>
          ${verified}
        </div>
        <div class="distance"><strong>${formatKm(c.distanceKm)}</strong><small>${esc(c.town)}</small></div>
        <button type="button" class="fav-btn" data-act="fav" data-id="${esc(c.id)}" data-name="${esc(c.name)}"
                aria-pressed="${fav}" aria-label="${fav ? 'Odebrat' : 'Přidat'} ${esc(c.name)} ${fav ? 'z oblíbených' : 'do oblíbených'}">${HEART}</button>
      </div>
      <p class="desc">${esc(c.description)}</p>
      ${c.hourlyRate ? `<p class="rate-line">Sazba: <strong>${formatNum(c.hourlyRate)} Kč/h</strong></p>` : ''}
      ${rating}
      ${review}
      <p class="avail${c.next.today ? ' avail-today' : ''}"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>
        <span>Nejbližší termín: <strong>${esc(c.next.text)}</strong></span></p>
      ${contact}
      <div class="actions">
        <button type="button" class="btn btn-primary" data-act="chat" data-id="${esc(c.id)}">Napsat zprávu</button>
        ${phoneHref ? `<a class="btn btn-secondary" href="${esc(phoneHref)}">Zavolat</a>` : ''}
      </div>
    </article>`;
}

function renderCards() {
  const box = $('#cards');
  const list = visibleResults();
  if (!list.length) {
    box.innerHTML = state.onlyToday && state.results.length
      ? '<p class="empty">Dnes už nikdo z nalezených řemeslníků není volný. Vypněte filtr „Volní dnes“ a zvolte nejbližší termín.</p>'
      : '<p class="empty">V okolí jsme nikoho nenašli. Zkuste změnit hledání nebo obecnější obor.</p>';
    return;
  }
  box.innerHTML = list.map(cardHtml).join('');
}

/* ----------------------------- Mapa (Leaflet) ----------------------------- */
let map = null;
let mapLayer = null;
let mapBounds = null;
let mapNeedsFit = false;
const markers = new Map(); // id → L.marker

function showMapNotice(msg) {
  const n = $('#map-notice');
  n.textContent = msg;
  n.hidden = !msg;
}

function ensureMap() {
  if (typeof L === 'undefined') {            // CDN nedostupné
    $('#map-fallback').hidden = false;
    return false;
  }
  $('#map-fallback').hidden = true;
  if (!map) {
    map = L.map('map', { zoomControl: true, attributionControl: true });
    const layer = Maps.tileLayer().addTo(map);
    let tileErrors = 0;
    layer.on('tileerror', () => {
      if (++tileErrors === 4) showMapNotice('Dlaždice mapy se nepodařilo načíst. Zkontrolujte připojení k internetu; seznam řemeslníků funguje dál.');
    });
    Maps.addBranding(map);
    Maps.checkKey().catch((e) => showMapNotice(e instanceof MapsError ? e.userMessage : 'Mapu se nepodařilo ověřit.'));
    mapLayer = L.layerGroup().addTo(map);
  }
  return true;
}

function pinIcon(iconKey, selected) {
  return L.divIcon({
    className: 'pin-wrap',
    html: `<div class="pin${selected ? ' is-selected' : ''}">${iconSvg(iconKey, 18)}</div>`,
    iconSize: [38, 46], iconAnchor: [19, 44], popupAnchor: [0, -40],
  });
}

/** Vykreslí na mapu značku „Vy“, okruh a značky řemeslníků. */
function renderMap() {
  if (!state.origin || !ensureMap()) return;
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
  visibleResults().forEach((c) => {
    const icon = Tree.get(c.categoryIds[0])?.icon || 'generic';
    const m = L.marker([c.lat, c.lng], { icon: pinIcon(icon, false), title: `${c.name} – ${c.role}`, keyboard: true }).addTo(mapLayer);
    m.bindPopup(`<strong>${esc(c.name)}</strong><br>${esc(c.role)} · ${formatKm(c.distanceKm)}` +
      `<br><button type="button" class="popup-show" data-id="${esc(c.id)}">Zobrazit kartu</button>`);
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
        setTimeout(() => $(`#card-${CSS.escape(btn.dataset.id)}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 60);
      });
    });
  }

  mapBounds = bounds;
  // Na mobilu je při prvním vykreslení mapa skrytá (má nulovou velikost) – přizpůsobíme ji až po zobrazení záložky.
  mapNeedsFit = true;
  if ($('#map').offsetWidth > 0) fitMap();
}

function fitMap() {
  if (!map || !mapBounds) return;
  map.invalidateSize();
  if (mapBounds.length > 1) map.fitBounds(mapBounds, { padding: [48, 48], maxZoom: 13 });
  else map.setView(mapBounds[0], 12);
  mapNeedsFit = false;
}

/** Vybere řemeslníka: zvýrazní kartu i značku. */
function selectCraftsman(id, { fromMap = false, fromCard = false } = {}) {
  state.selectedId = id;
  $$('.card').forEach((el) => el.classList.toggle('is-selected', el.dataset.id === id));
  markers.forEach((m, mid) => {
    m.getElement()?.querySelector('.pin')?.classList.toggle('is-selected', mid === id);
    m.setZIndexOffset(mid === id ? 1000 : 0);
  });
  const marker = markers.get(id);
  if (marker && fromCard && map) {
    map.panTo(marker.getLatLng(), { animate: true });
    marker.openPopup();
  }
  if (fromMap) $(`#card-${CSS.escape(id)}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
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

/* ==========================================================================
   Chat – simulovaný, konverzace v localStorage (fixit:chat:<uživatel>:<řemeslník>)
   Psát zprávy smí jen přihlášený uživatel.
   ========================================================================== */
const chat = { c: null, opener: null, timers: {} };

function priceReplyText(c) {
  const g = Prices.forCategory(c.categoryIds[0])[0];
  return g
    ? `Orientačně počítejte s ${Prices.sentence(g)}. Přesnější nabídku udělám na místě.`
    : 'Cenu upřesním podle rozsahu práce. Pomůže mi fotka problému.';
}

const SIMULATED_REPLIES = [
  (c) => `Dobrý den, píše vám ${c.name} – děkuji za zprávu. ${c.distanceKm != null ? `K vaší adrese to mám ${formatKm(c.distanceKm)}. ` : ''}Nejbližší termín mám: ${nextAvailability(c).text}. Hodí se vám to?`,
  () => 'Rozumím. Pošlete mi prosím, pokud můžete, fotku problému, ať se na to můžu předem připravit.',
  (c) => priceReplyText(c),
  () => 'Platí, ozvu se den předem telefonicky. Děkuji!',
];

const chatKey = (cid) => `chat:${Auth.user()?.id || 'anon'}:${cid}`;

function loadChat(cid) {
  const parsed = storage.getJson(chatKey(cid), []);
  return Array.isArray(parsed) ? parsed : [];
}
const saveChat = (cid, messages) => storage.setJson(chatKey(cid), messages);

const timeLabel = (ts) => new Date(ts).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });

function renderChat(typing = false) {
  const c = chat.c;
  const log = $('#chat-log');
  const messages = loadChat(c.id);
  log.innerHTML = messages.map((m) => `
    <div class="msg ${m.from === 'me' ? 'msg-me' : 'msg-them'}">
      <div class="bubble">${esc(m.text).replace(/\n/g, '<br>')}</div>
      <div class="meta">${m.demo ? '<span class="demo-tag">Ukázková odpověď (demo)</span> ' : ''}${esc(m.from === 'me' ? 'Vy' : c.name)} · ${timeLabel(m.ts)}</div>
    </div>`).join('') +
    (typing ? `<div class="msg msg-them"><div class="bubble typing" aria-label="${esc(c.name)} píše"><span></span><span></span><span></span></div></div>` : '');
  log.scrollTop = log.scrollHeight;
}

function pushMessage(cid, from, text, demo = false) {
  const messages = loadChat(cid);
  messages.push({ from, text, ts: Date.now(), demo });
  saveChat(cid, messages);
}

/** Po chvíli „odpoví“ řemeslník – ukázková odpověď, jasně označená jako demo. */
function scheduleReply(c) {
  clearTimeout(chat.timers[c.id]);
  if (chat.c?.id === c.id) renderChat(true);
  const key = chatKey(c.id);
  chat.timers[c.id] = setTimeout(() => {
    if (chatKey(c.id) !== key) return;               // mezitím se uživatel odhlásil / přepnul
    const repliesSoFar = loadChat(c.id).filter((m) => m.from === 'them').length;
    pushMessage(c.id, 'them', SIMULATED_REPLIES[Math.min(repliesSoFar, SIMULATED_REPLIES.length - 1)](c), true);
    if (chat.c?.id === c.id) renderChat(false);
  }, 1400 + Math.random() * 900);
}

function openChat(c, opener) {
  Auth.require('Pro psaní zprávy řemeslníkovi se prosím přihlaste.', () => {
    chat.c = c;
    $('#chat-avatar').src = avatarUri(c.name, c.id);
    $('#chat-avatar').alt = `Avatar z iniciálů: ${c.name}`;
    $('#chat-title').textContent = c.name;
    $('#chat-role').textContent = `${c.role} · ${c.town}`;

    // První zpráva = popis problému (jen u nové konverzace)
    if (!loadChat(c.id).length) {
      const cat = state.categoryId ? Tree.get(state.categoryId) : null;
      const first = state.problem || `Dobrý den, hledám pomoc: ${(cat ? cat.name : 'oprava v domácnosti').toLowerCase()}.`;
      pushMessage(c.id, 'me', first);
      scheduleReply(c);
    }
    renderChat();
    Modal.open($('#chat'), { opener: opener || document.activeElement, focus: '#chat-input', onClose: () => { chat.c = null; } });
  }, opener);
}

function initChat() {
  $('#chat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#chat-input');
    const text = input.value.trim();
    if (!text || !chat.c) return;
    pushMessage(chat.c.id, 'me', text);
    input.value = '';
    input.style.height = '';
    scheduleReply(chat.c);
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
    if (!chat.c) return;
    clearTimeout(chat.timers[chat.c.id]);
    storage.remove(chatKey(chat.c.id));
    renderChat();
    $('#chat-input').focus();
  });
}

/* ==========================================================================
   Start
   ========================================================================== */
function renderMapCredits() {
  if (Maps.provider === 'mapy') {
    $('#footer-map-credit').innerHTML = 'Mapové podklady <a href="https://api.mapy.com/copyright" target="_blank" rel="noopener">© Seznam.cz a.s. and others</a> ' + Maps.logoHtml(16);
    $('#address-credit').innerHTML = 'Našeptávání adres: ' + Maps.logoHtml(14);
  } else {
    $('#footer-map-credit').innerHTML = 'Mapové podklady © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">přispěvatelé OpenStreetMap</a>';
  }
}

function renderModeNote(notice) {
  const parts = [state.ds.mode === 'supabase' ? 'Data: Supabase' : 'Záložní režim: lokální data', `Mapa: ${Maps.provider === 'mapy' ? 'Mapy.com' : 'OpenStreetMap'}`];
  $('#mode-note').textContent = parts.join(' · ');
  if (notice) toast(notice, 'error');
}

/** Chyby z e-mailových odkazů Supabase (např. prošlý odkaz) – ukážeme je a vrátíme se na úvod. */
function handleAuthRedirectErrors() {
  const h = location.hash;
  if (!/[#&]error(_code)?=/.test(h)) return;
  const p = new URLSearchParams(h.replace(/^#\/?\??/, ''));
  const expired = /otp_expired/.test(p.get('error_code') || '');
  toast(expired ? 'Odkaz z e-mailu už vypršel nebo byl použit. Požádejte o nový.' : 'Přihlášení pomocí odkazu se nepodařilo.', 'error');
  history.replaceState(null, '', location.pathname + '#/');
}

async function init() {
  // viditelné až po inicializaci
  const boot = await initDataSource();
  state.ds = boot.ds;
  state.data = boot.data;
  Tree.set(state.data.categories);
  Prices.set(state.data.priceGuides);

  renderMapCredits();
  renderModeNote(boot.notice);

  await Auth.init(state.ds);
  // po přesměrování z e-mailu (PKCE) smažeme ?code=… z adresy
  if (/[?&](code|error)=/.test(location.search)) history.replaceState(null, '', location.pathname + location.hash);
  handleAuthRedirectErrors();

  const u = Auth.user();
  lastIdentity = u ? `${u.id}|${u.role}` : '';
  if (u && !Roles.get() && ROLES.includes(u.role)) Roles.set(u.role);
  await loadFavorites();
  Auth.onChange(onAuthChange);

  // ---- úvod: výběr kategorie, adresa, popis ----
  CategoryPicker.init({
    onChange(id) {
      showError('#problem-error', '');
      updateProblemHint();
    },
  });
  addressInput = AddressInput.attach({
    input: $('#address'), list: $('#address-list'),
    onPick() { showError('#address-error', ''); $('#town-fallback').hidden = true; },
    onError: (msg) => showError('#address-error', msg),
  });
  $('#address').addEventListener('input', () => { showError('#address-error', ''); $('#town-fallback').hidden = true; });
  $$('.chip[data-example]').forEach((chip) => chip.addEventListener('click', () => {
    $('#problem').value = chip.dataset.example;
    showError('#problem-error', '');
    updateProblemHint();
    $('#problem').focus();
  }));
  $('#problem').addEventListener('input', () => { showError('#problem-error', ''); updateProblemHint(); });
  $('#search-form').addEventListener('submit', onSubmit);
  $('#town-continue').addEventListener('click', onTownContinue);

  // ---- výsledky ----
  $$('[data-action="back"]').forEach((b) => b.addEventListener('click', () => {
    navigate('#/');
    setTimeout(() => $('#address').focus(), 50);
  }));
  $('#sort-select').addEventListener('change', (e) => { state.sort = e.target.value; renderResults(); });
  $('#filter-today').addEventListener('change', (e) => { state.onlyToday = e.target.checked; renderResults(); });
  $$('.mobile-tabs [role="tab"]').forEach((b) => b.addEventListener('click', () => setResultsTab(b.dataset.tab)));

  // Delegace kliků v seznamu: chat, oblíbené, nebo výběr karty
  $('#cards').addEventListener('click', (e) => {
    const favBtn = e.target.closest('[data-act="fav"]');
    if (favBtn) { Auth.require('Pro ukládání oblíbených se prosím přihlaste.', () => toggleFavorite(favBtn.dataset.id), favBtn); return; }
    const chatBtn = e.target.closest('[data-act="chat"]');
    if (chatBtn) {
      const c = state.results.find((r) => r.id === chatBtn.dataset.id);
      if (c) openChat(c, chatBtn);
      return;
    }
    if (e.target.closest('a, button')) return;
    const card = e.target.closest('.card');
    if (card) selectCraftsman(card.dataset.id, { fromCard: true });
  });
  // po zaostření klávesnicí na kartu (tlačítko uvnitř) kartu také zvýrazníme
  $('#cards').addEventListener('focusin', (e) => {
    const card = e.target.closest('.card');
    if (card && card.dataset.id !== state.selectedId) selectCraftsman(card.dataset.id);
  });

  // ---- záhlaví: role ----
  $('#role-select').addEventListener('change', (e) => chooseRole(e.target.value));
  $$('#role-modal [data-role]').forEach((b) => b.addEventListener('click', () => chooseRole(b.dataset.role)));

  initChat();

  window.addEventListener('hashchange', route);
  await route();
  if (!Roles.get()) showRoleModal();
}

document.addEventListener('DOMContentLoaded', () => {
  init().catch((err) => {
    console.error('FixIt se nepodařilo spustit:', err);
    const main = $('#main');
    if (main) main.insertAdjacentHTML('afterbegin', '<p class="error" role="alert" style="padding:24px">Aplikaci se nepodařilo spustit. Zkuste stránku obnovit.</p>');
  });
});
