/* ==========================================================================
   util.js – společné pomocné funkce FixIt (DOM, text, úložiště, modální okna)
   ========================================================================== */
'use strict';

const CFG = window.FIXIT_CONFIG || {};
const STORAGE_PREFIX = 'fixit:';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** Ochrana proti vložení HTML (data se vkládají přes innerHTML). */
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/** Malá písmena a odstranění diakritiky: „Kape KOHOUTEK“ → „kape kohoutek“. */
function normalize(text) {
  return String(text ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** České skloňování podle počtu: plural(3, ['řemeslník', 'řemeslníci', 'řemeslníků']). */
function plural(n, [one, few, many]) {
  if (n === 1) return one;
  if (n >= 2 && n <= 4) return few;
  return many;
}

function formatKm(km) {
  return km.toLocaleString('cs-CZ', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' km';
}

/** 1200 → „1 200“ (pevná mezera jako oddělovač tisíců). */
function formatNum(n) {
  return Number(n).toLocaleString('cs-CZ', { maximumFractionDigits: 1 }).replace(/\s/g, ' ');
}

function debounce(fn, ms) {
  let t;
  const wrapped = (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  wrapped.cancel = () => clearTimeout(t);
  return wrapped;
}

/** Úložiště odolné vůči zablokovanému localStorage (soukromý režim apod.). Klíče mají prefix `fixit:`. */
const memoryStore = {};
const storage = {
  get(key) {
    try { return localStorage.getItem(STORAGE_PREFIX + key); } catch (e) { return memoryStore[key] ?? null; }
  },
  set(key, value) {
    try { localStorage.setItem(STORAGE_PREFIX + key, value); } catch (e) { memoryStore[key] = value; }
  },
  remove(key) {
    try { localStorage.removeItem(STORAGE_PREFIX + key); } catch (e) { delete memoryStore[key]; }
  },
  getJson(key, fallback = null) {
    try {
      const raw = storage.get(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  },
  setJson(key, value) { storage.set(key, JSON.stringify(value)); },
};

/** Číselný „seed“ z řetězce (pro barvu avatara). */
function seedFromId(id) {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

/** Generovaný avatar z iniciál (SVG data URI) – žádné reálné fotky osob. */
const AVATAR_PALETTES = [
  ['#031927', '#9DD1F1'], ['#508AA8', '#031927'], ['#9DD1F1', '#031927'],
  ['#BA1200', '#FFFFFF'], ['#C8E0F4', '#031927'], ['#031927', '#C8E0F4'],
];
function avatarUri(name, id = '') {
  const initials = String(name).split(/[\s.]+/).filter(Boolean).map((s) => s[0]).slice(0, 2).join('').toUpperCase() || '?';
  const [bg, fg] = AVATAR_PALETTES[seedFromId(id || name) % AVATAR_PALETTES.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${bg}"/>` +
    `<text x="32" y="32" dy=".35em" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="26" font-weight="700" fill="${fg}">${esc(initials)}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/** Dynamicky načte skript (např. supabase-js z CDN s kontrolou integrity). */
function loadScript(src, integrity) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    if (integrity) { s.integrity = integrity; }
    s.crossOrigin = 'anonymous';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Nepodařilo se načíst ' + src));
    document.head.appendChild(s);
  });
}

/* ==========================================================================
   Modální okna – společná správa (Esc, zachycení Tabu, návrat fokusu)
   ========================================================================== */
const Modal = (() => {
  const stack = []; // [{ el, opener, onClose }]

  function top() { return stack[stack.length - 1]; }

  function open(el, { opener = document.activeElement, onClose = null, focus = null } = {}) {
    el.hidden = false;
    stack.push({ el, opener, onClose });
    document.body.classList.add('modal-open');
    const target = (focus && $(focus, el)) || $('[autofocus]', el) ||
      $$('input:not([type=hidden]), textarea, select, button, [href]', el).find((n) => !n.disabled && n.offsetParent !== null);
    if (target) setTimeout(() => target.focus(), 0);
  }

  function close(el) {
    const i = stack.findIndex((m) => m.el === el);
    if (i < 0) { el.hidden = true; return; }
    const [m] = stack.splice(i, 1);
    el.hidden = true;
    if (!stack.length) document.body.classList.remove('modal-open');
    if (m.opener && document.contains(m.opener)) m.opener.focus();
    if (m.onClose) m.onClose();
  }

  document.addEventListener('keydown', (e) => {
    const m = top();
    if (!m) return;
    if (e.key === 'Escape') { e.preventDefault(); close(m.el); return; }
    if (e.key !== 'Tab') return;
    const focusable = $$('button, textarea, input:not([type=hidden]), select, [href]', m.el)
      .filter((n) => !n.disabled && n.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  // klik na pozadí (prvek s data-close) nebo na křížek zavře okno
  document.addEventListener('click', (e) => {
    const closer = e.target.closest('[data-close]');
    if (!closer) return;
    const modal = closer.closest('.modal');
    if (modal && top() && top().el === modal) close(modal);
  });

  return { open, close, isOpen: (el) => stack.some((m) => m.el === el) };
})();

/** Krátké potvrzení / chybová hláška (toast) – zmizí samo. */
function toast(message, kind = 'info') {
  let box = $('#toasts');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toasts';
    box.setAttribute('role', 'status');
    box.setAttribute('aria-live', 'polite');
    document.body.appendChild(box);
  }
  const el = document.createElement('div');
  el.className = 'toast toast-' + kind;
  el.textContent = message;
  box.appendChild(el);
  setTimeout(() => el.remove(), 5200);
}
