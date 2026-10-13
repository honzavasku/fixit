/* ==========================================================================
   maps.js – vrstva pro mapy a adresy se jednotným rozhraním
   --------------------------------------------------------------------------
   Maps.provider        'mapy' (je-li v config.js MAPY_API_KEY) nebo 'osm'
   Maps.geocode(text)   → { lat, lng, label } | null       (při chybě vyhodí MapsError)
   Maps.suggest(text)   → [{ label, secondary, kind, lat, lng }]  (našeptávání)
   Maps.tileLayer()     → Leaflet vrstva s dlaždicemi a povinnou atribucí
   Maps.addBranding(m)  → přidá na mapu logo (Mapy.com vyžaduje logo nad mapou)
   Maps.logoHtml(h)     → HTML loga pro místa u vyhledávání adres
   Maps.checkKey()      → ověří klíč Mapy.com (vyhodí MapsError)

   Mapy.com (REST API, ověřeno v dokumentaci api.mapy.com/v1/docs):
     dlaždice  GET https://api.mapy.com/v1/maptiles/{mapset}/{256|256@2x}/{z}/{x}/{y}?apikey=…
     geocode   GET https://api.mapy.com/v1/geocode?query=…&lang=cs&locality=cz&apikey=…
     suggest   GET https://api.mapy.com/v1/suggest?query=…&lang=cs&locality=cz&apikey=…
   Atribuce: logo (min. výška 30 px nad mapou, odkaz na https://mapy.com/) a text
   „Seznam.cz a.s. and others“ s odkazem na https://api.mapy.com/copyright.
   Pro ostatní funkce (geokódování, našeptávání) má být logo poblíž dat.

   OpenStreetMap + Nominatim (záloha): max. 1 dotaz za sekundu, bez našeptávání
   (veřejný Nominatim automatické doplňování při psaní zakazuje).
   ========================================================================== */
'use strict';

class MapsError extends Error {
  /** code: key | rate | query | server | network | notfound */
  constructor(code, userMessage, cause) {
    super(userMessage);
    this.name = 'MapsError';
    this.code = code;
    this.userMessage = userMessage;
    this.cause = cause;
  }
}

const Maps = (() => {
  const key = String(CFG.MAPY_API_KEY || '').trim();
  const provider = key ? 'mapy' : 'osm';

  const MAPY_BASE = 'https://api.mapy.com/v1';
  const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
  const MAPY_LOGO = 'https://api.mapy.com/img/api/logo.svg';
  const TIMEOUT_MS = 8000;

  const MESSAGES = {
    key: 'Klíč k Mapy.com není platný nebo nemá povolenou tuto doménu. Zkontrolujte ho v config.js a v nastavení na developer.mapy.com.',
    rate: 'Služba map je dočasně přetížená (příliš mnoho dotazů). Zkuste to prosím za chvíli.',
    query: 'Službě map se nepodařilo adresu zpracovat. Zkuste ji napsat jinak.',
    server: 'Služba map je teď nedostupná. Zkuste to prosím později.',
    network: 'Nepodařilo se spojit se službou map. Zkontrolujte připojení k internetu.',
  };

  /** Převede HTTP stav / výjimku na srozumitelnou MapsError. */
  function toError(err, status) {
    if (err instanceof MapsError) return err;
    if (status === 401 || status === 403) return new MapsError('key', MESSAGES.key, err);
    if (status === 429) return new MapsError('rate', MESSAGES.rate, err);
    if (status === 400 || status === 422) return new MapsError('query', MESSAGES.query, err);
    if (status >= 500) return new MapsError('server', MESSAGES.server, err);
    return new MapsError('network', MESSAGES.network, err);
  }

  async function fetchJson(url, { signal, headers } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true });
    let res;
    try {
      res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json', ...headers } });
    } catch (e) {
      if (signal && signal.aborted) throw e;           // zrušeno voláním (nový dotaz) – není to chyba
      throw toError(e);
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) throw toError(new Error('HTTP ' + res.status), res.status);
    try { return await res.json(); } catch (e) { throw toError(e, 500); }
  }

  const stripCountry = (s) => String(s || '').replace(/,\s*Česko$/, '');

  /* ---------------------------- Mapy.com ---------------------------- */
  function mapyUrl(path, params) {
    const q = new URLSearchParams({ lang: 'cs', locality: 'cz', ...params, apikey: key });
    return `${MAPY_BASE}/${path}?${q}`;
  }
  function mapyItem(it) {
    return {
      label: [it.name, stripCountry(it.location)].filter(Boolean).join(', '),
      secondary: it.label || '',
      kind: it.type || '',
      lat: it.position.lat,
      lng: it.position.lon,
    };
  }
  async function mapyGeocode(text) {
    const data = await fetchJson(mapyUrl('geocode', { query: text, limit: '1' }));
    const hit = (data.items || []).find((i) => i.position);
    return hit ? mapyItem(hit) : null;
  }
  async function mapySuggest(text, signal) {
    const data = await fetchJson(mapyUrl('suggest', { query: text, limit: '6' }), { signal });
    return (data.items || []).filter((i) => i.position).map(mapyItem);
  }

  /* ----------------------- OpenStreetMap / Nominatim ----------------------- */
  let lastNominatimAt = 0;
  async function osmGeocode(text) {
    // dodržení limitu 1 dotaz / s
    const wait = lastNominatimAt + 1100 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastNominatimAt = Date.now();
    const params = new URLSearchParams({
      format: 'jsonv2', q: text, countrycodes: 'cz', limit: '1', 'accept-language': 'cs',
    });
    const data = await fetchJson(`${NOMINATIM_URL}?${params}`);
    const hit = data[0];
    return hit
      ? { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon), label: hit.display_name.split(',').slice(0, 3).join(',').trim() }
      : null;
  }

  /* ----------------------------- veřejné API ----------------------------- */
  const cache = new Map();
  async function geocode(text) {
    const k = normalize(text).trim();
    if (!k) return null;
    if (cache.has(k)) return cache.get(k);
    const result = provider === 'mapy' ? await mapyGeocode(text) : await osmGeocode(text);
    cache.set(k, result);
    return result;
  }

  async function suggest(text, signal) {
    if (provider !== 'mapy' || String(text).trim().length < 2) return [];
    return mapySuggest(String(text).trim(), signal);
  }

  function tileLayer() {
    if (provider === 'mapy') {
      const size = (window.devicePixelRatio || 1) > 1 ? '256@2x' : '256';
      return L.tileLayer(`${MAPY_BASE}/maptiles/basic/${size}/{z}/{x}/{y}?apikey=${encodeURIComponent(key)}`, {
        minZoom: 0, maxZoom: 19, tileSize: 256,
        attribution: '<a href="https://api.mapy.com/copyright" target="_blank" rel="noopener">&copy; Seznam.cz a.s. and others</a>',
      });
    }
    return L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">přispěvatelé OpenStreetMap</a>',
    });
  }

  /** Logo Mapy.com nad mapou (vlevo dole), klikací, výška 30 px. */
  function addBranding(map) {
    if (provider !== 'mapy') return;
    const Brand = L.Control.extend({
      options: { position: 'bottomleft' },
      onAdd() {
        const a = L.DomUtil.create('a', 'mapy-logo');
        a.href = 'https://mapy.com/';
        a.target = '_blank';
        a.rel = 'noopener';
        a.title = 'Mapy.com';
        a.setAttribute('aria-label', 'Mapy.com');
        a.innerHTML = `<img src="${MAPY_LOGO}" alt="Mapy.com" height="30">`;
        L.DomEvent.disableClickPropagation(a);
        return a;
      },
    });
    new Brand().addTo(map);
  }

  /** Logo u práce s adresami (min. výška 10 px mimo mapu). */
  function logoHtml(height = 14) {
    if (provider !== 'mapy') return '';
    return `<a class="mapy-logo-inline" href="https://mapy.com/" target="_blank" rel="noopener" aria-label="Mapy.com">` +
      `<img src="${MAPY_LOGO}" alt="Mapy.com" height="${height}"></a>`;
  }

  /** Jednorázově ověří klíč (tiles.json vrací 401/403 při špatném klíči). */
  async function checkKey() {
    if (provider !== 'mapy') return;
    let res;
    try {
      res = await fetch(`${MAPY_BASE}/maptiles/basic/tiles.json?apikey=${encodeURIComponent(key)}`);
    } catch (e) { throw toError(e); }
    if (!res.ok) throw toError(new Error('HTTP ' + res.status), res.status);
  }

  return {
    provider,
    supportsSuggest: provider === 'mapy',
    geocode, suggest, tileLayer, addBranding, logoHtml, checkKey,
  };
})();
