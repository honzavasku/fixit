/* ==========================================================================
   categories.js – strom kategorií, určení oboru z textu, výběr kategorie
   (proklik po úrovních + hledání) a „Orientační odhad“ ceny.

   Závisí na util.js. Data (kategorie, ceník) dodává aplikace přes
   Tree.set() a Prices.set(), takže zdroj (lokální / Supabase) je jedno.
   ========================================================================== */
'use strict';

/* Ikony kategorií: klíč v tabulce categories.icon → SVG obsah pro viewBox 24×24 (obrys). */
const ICONS = {
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>',
  drop: '<path d="M12 3s6 6.2 6 10.5A6 6 0 0 1 6 13.5C6 9.2 12 3 12 3z"/>',
  tap: '<path d="M4 8h9a3 3 0 0 1 3 3v1"/><path d="M8 8V5M5 5h6"/><path d="M17 16s1.5 1.8 1.5 3a1.5 1.5 0 0 1-3 0c0-1.2 1.5-3 1.5-3z"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  flame: '<path d="M12 22c4 0 7-2.7 7-6.5 0-3-2-5-3.5-6.5.2 2-.8 3-2 3 .5-3-1.5-6-4-8 0 4-4.5 6-4.5 11.5C5 19.3 8 22 12 22z"/>',
  paint: '<rect x="4" y="3" width="14" height="6" rx="1.5"/><path d="M18 6h2v5h-8v3"/><rect x="10" y="14" width="4" height="7" rx="1"/>',
  door: '<rect x="5" y="3" width="14" height="18" rx="1.5"/><circle cx="15" cy="12.5" r="1"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12 20 3M16 7l3 3M14 9l2 2"/>',
  roof: '<path d="M3 12 12 4l9 8M6 10v10h12V10"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.1L3 17.7 6.3 21l6.3-6.3a4 4 0 0 0 5.1-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
  tree: '<path d="M12 22v-7"/><path d="M12 15c-4 0-6-2.5-6-5.5 0-2 1.3-3.5 3-4 .5-1.5 1.7-2.5 3-2.5s2.5 1 3 2.5c1.7.5 3 2 3 4 0 3-2 5.5-6 5.5z"/>',
  grass: '<path d="M4 20c0-6 2-9 4-12M10 20c0-5 1-8 2-12M16 20c0-5-1-8-3-11M20 20c0-5-1-7-2-9"/>',
  fence: '<path d="M5 20V8l2-2 2 2v12M11 20V8l2-2 2 2v12M17 20V8l2-2v14M3 12h18M3 17h18"/>',
  deck: '<path d="M3 9h18M3 14h18M3 19h18M7 9v10M13 9v10M17 9v10"/>',
  sprinkler: '<path d="M12 21v-9"/><path d="M12 12c-4 0-7-2-8-5M12 12c4 0 7-2 8-5M12 12c-2-2-3-4-3-7M12 12c2-2 3-4 3-7"/>',
  brick: '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 10h18M3 15h18M9 5v5M15 10v5M9 15v4"/>',
  tiles: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
  layers: '<path d="M12 3 3 8l9 5 9-5z"/><path d="M3 13l9 5 9-5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
  snow: '<path d="M12 2v20M4 7l16 10M4 17 20 7"/>',
  heatpump: '<rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="12" cy="12" r="4"/><path d="M12 8v8M8 12h8"/>',
  generic: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17h.01"/>',
};

function iconSvg(iconKey, size = 24) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[iconKey] || ICONS.generic}</svg>`;
}

/* ==========================================================================
   Strom kategorií
   ========================================================================== */
const Tree = (() => {
  let all = [];                 // ve pořadí „do hloubky“ (rodič, pak jeho děti)
  const byId = new Map();
  const kids = new Map();       // parent_id (nebo null) → [kategorie]

  function set(list) {
    byId.clear(); kids.clear();
    list.forEach((c) => byId.set(c.id, c));
    list.forEach((c) => {
      const p = c.parent_id && byId.has(c.parent_id) ? c.parent_id : null;
      if (!kids.has(p)) kids.set(p, []);
      kids.get(p).push(c);
    });
    kids.forEach((arr) => arr.sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name, 'cs')));
    all = [];
    const walk = (parent) => (kids.get(parent) || []).forEach((c) => { all.push(c); walk(c.id); });
    walk(null);
  }

  const get = (id) => byId.get(id) || null;
  const children = (id) => kids.get(id ?? null) || [];
  const isLeaf = (id) => children(id).length === 0;

  /** [kořen, …, uzel] */
  function path(id) {
    const out = [];
    for (let c = get(id), guard = 0; c && guard < 10; c = get(c.parent_id), guard++) out.unshift(c);
    return out;
  }
  const pathNames = (id) => path(id).map((c) => c.name).join(' › ');
  const depth = (id) => path(id).length;

  /** Uzel + všichni jeho potomci (ids). */
  function subtreeIds(id) {
    const out = [id];
    children(id).forEach((c) => out.push(...subtreeIds(c.id)));
    return out;
  }
  /** Uzel + všichni jeho předci (ids). */
  const ancestorIds = (id) => path(id).map((c) => c.id);

  /** Pokrývá řemeslník s obory `catIds` vybraný uzel? (shoda, potomek nebo nadřazená kategorie) */
  function covers(catIds, selectedId) {
    if (!selectedId) return true;
    const related = new Set([...subtreeIds(selectedId), ...ancestorIds(selectedId)]);
    return (catIds || []).some((id) => related.has(id));
  }

  return { set, get, children, isLeaf, path, pathNames, depth, subtreeIds, ancestorIds, covers, all: () => all };
})();

/* ==========================================================================
   classifyProblem – určení oboru z textu (klíčová slova z categories.keywords)
   --------------------------------------------------------------------------
   Klíčová slova jsou bez diakritiky a hledají se od začátku slova („zasuvk“
   chytí zásuvka, zásuvky…). Koncová mezera = přesné slovo. Vrací:
     { categoryId | null, score, gas }
   Při shodě více kategorií vyhrává ta s víc zásahy; při rovnosti konkrétnější
   (potomek) před obecnější (předek), jinak nejbližší společný předek.
   `gas` = text popisuje zápach / únik plynu (bezpečnostní upozornění).
   ========================================================================== */

/** Text popisuje zápach nebo únik plynu (plyn + slovo o zápachu / úniku). */
function detectGasLeak(normalized) {
  return /\bplyn/.test(normalized) &&
    /(\bcit|cuch|zapach|zapacha|smrd|smrad|pach|unik|syc|syk|zacpa|vonet|voni)/.test(normalized);
}

function classifyProblem(text) {
  const t = ' ' + normalize(text || '').replace(/[^a-z0-9]+/g, ' ') + ' ';
  const gas = detectGasLeak(t);

  let best = 0;
  let cands = [];
  for (const c of Tree.all()) {
    let score = 0;
    for (const raw of c.keywords || []) {
      const w = normalize(raw);
      if (!w.trim()) continue;
      // shoda jen od začátku slova, ať „plot“ nechytí „plotna“ uprostřed věty
      if (t.includes(' ' + w) || (w.trim().includes(' ') && t.includes(w))) score += 1;
    }
    if (score > best) { best = score; cands = [c.id]; }
    else if (score === best && score > 0) cands.push(c.id);
  }

  let categoryId = null;
  if (cands.length) {
    // předek jiného kandidáta je obecnější → vyřadit
    const specific = cands.filter((id) => !cands.some((o) => o !== id && Tree.ancestorIds(o).includes(id)));
    if (specific.length === 1) categoryId = specific[0];
    else {
      // nejbližší společný předek; bez něj první v pořadí stromu
      const chains = specific.map((id) => Tree.ancestorIds(id));
      const common = chains[0].filter((id) => chains.every((ch) => ch.includes(id)));
      categoryId = common.length ? common[common.length - 1] : specific[0];
    }
  }
  if (gas) return { categoryId: 'topeni', score: Math.max(best, 1), gas };
  return { categoryId, score: best, gas };
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
   Výběr kategorie: proklik po úrovních (dlaždice + drobečky) + hledání
   ========================================================================== */
const CategoryPicker = (() => {
  let onChange = () => {};
  let selectedId = null;
  let pathIds = [];          // aktuální umístění ve stromu (ids předků zobrazených dlaždic)
  let query = '';

  const el = {};

  function init(opts = {}) {
    onChange = opts.onChange || (() => {});
    el.root = $('#category-picker');
    el.search = $('#cat-search');
    el.crumbs = $('#cat-crumbs');
    el.body = $('#cat-body');
    el.selected = $('#cat-selected');

    el.search.addEventListener('input', () => { query = el.search.value; render(); });
    el.search.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); const first = $('.cat-result', el.body); if (first) first.click(); }
      if (e.key === 'Escape' && query) { e.stopPropagation(); clearQuery(); }
    });

    el.root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-cat-action]');
      if (!b) return;
      const id = b.dataset.id || null;
      switch (b.dataset.catAction) {
        case 'open': pathIds = Tree.ancestorIds(id); render(); focusFirstTile(); break;
        case 'crumb': pathIds = id ? Tree.ancestorIds(id) : []; render(); focusFirstTile(); break;
        case 'toggle': setSelected(selectedId === id ? null : id, { announce: true }); break;
        case 'pick': clearQuery(false); pathIds = Tree.ancestorIds(id).slice(0, -1); setSelected(id, { announce: true }); break;
        case 'clear': setSelected(null); break;
      }
    });
    render();
  }

  function clearQuery(rerender = true) {
    query = ''; el.search.value = '';
    if (rerender) render();
  }

  function focusFirstTile() {
    const t = $('.tile-box', el.body);
    if (t) t.focus();
  }

  function setSelected(id, { announce = false } = {}) {
    selectedId = id || null;
    render();
    onChange(selectedId, { announce });
  }

  function matches(c, nq) {
    if (normalize(c.name).includes(nq)) return true;
    return (c.keywords || []).some((k) => {
      const nk = normalize(k).trim();
      return nk && (nk.startsWith(nq) || (nq.length >= 4 && nq.startsWith(nk) && nk.length >= 4));
    });
  }

  function tileHtml(c) {
    const hasKids = !Tree.isLeaf(c.id);
    const sel = selectedId === c.id;
    const inSel = selectedId && !sel && Tree.ancestorIds(selectedId).includes(c.id);
    return `
      <button type="button" class="tile-box${sel ? ' is-selected' : ''}${inSel ? ' has-selected' : ''}" data-cat-action="${hasKids ? 'open' : 'toggle'}" data-id="${esc(c.id)}"
              ${hasKids ? `aria-label="${esc(c.name)} – zobrazit podkategorie"` : `aria-pressed="${sel}"`}>
        <span class="tile-icon">${iconSvg(c.icon, 28)}</span>
        <span class="tile-label">${esc(c.name)}</span>
        ${hasKids ? '<span class="tile-more" aria-hidden="true">podkategorie ›</span>' : ''}
      </button>`;
  }

  function render() {
    const nq = normalize(query).trim();
    const currentId = pathIds[pathIds.length - 1] || null;

    // drobečková navigace
    if (nq) {
      el.crumbs.hidden = true;
    } else {
      el.crumbs.hidden = false;
      const parts = [`<button type="button" class="crumb" data-cat-action="crumb" data-id=""${currentId ? '' : ' aria-current="page"'}>Všechny obory</button>`];
      pathIds.forEach((id, i) => {
        const last = i === pathIds.length - 1;
        parts.push(`<span class="crumb-sep" aria-hidden="true">›</span><button type="button" class="crumb" data-cat-action="crumb" data-id="${esc(id)}"${last ? ' aria-current="page"' : ''}>${esc(Tree.get(id).name)}</button>`);
      });
      el.crumbs.innerHTML = parts.join('');
    }

    // obsah: výsledky hledání, nebo dlaždice aktuální úrovně
    if (nq.length >= 2) {
      const found = Tree.all().filter((c) => matches(c, nq)).slice(0, 12);
      el.body.innerHTML = found.length
        ? `<ul class="cat-results" aria-label="Nalezené obory">${found.map((c) => `
            <li><button type="button" class="cat-result" data-cat-action="pick" data-id="${esc(c.id)}">
              <span class="tile-icon">${iconSvg(c.icon, 22)}</span>
              <span><strong>${esc(c.name)}</strong><small>${esc(Tree.path(c.id).slice(0, -1).map((p) => p.name).join(' › ') || 'Hlavní obor')}</small></span>
            </button></li>`).join('')}</ul>`
        : '<p class="help">Nic jsme nenašli. Zkuste jiné slovo, nebo obor popište níže v kroku 3.</p>';
    } else {
      const kids = Tree.children(currentId);
      const selectWhole = currentId ? `
        <button type="button" class="btn btn-secondary btn-sm cat-whole" data-cat-action="toggle" data-id="${esc(currentId)}" aria-pressed="${selectedId === currentId}">
          ${selectedId === currentId ? '✓ Vybráno: celá kategorie' : 'Vybrat celou kategorii'} „${esc(Tree.get(currentId).name)}“
        </button>` : '';
      el.body.innerHTML = selectWhole + `<div class="tiles">${kids.map(tileHtml).join('')}</div>`;
    }

    // shrnutí výběru
    if (selectedId && Tree.get(selectedId)) {
      el.selected.hidden = false;
      el.selected.innerHTML = `Vybráno: <strong>${esc(Tree.pathNames(selectedId))}</strong> <button type="button" class="link-btn" data-cat-action="clear">Zrušit výběr</button>`;
    } else {
      el.selected.hidden = true;
      el.selected.textContent = '';
    }
  }

  return {
    init, render,
    getSelected: () => selectedId,
    setSelected(id) { selectedId = id || null; pathIds = id ? Tree.ancestorIds(id).slice(0, -1) : []; render(); },
    reset() { selectedId = null; pathIds = []; clearQuery(false); render(); },
  };
})();

/* ==========================================================================
   Orientační odhad ceny (tabulka price_guides)
   ========================================================================== */
const Prices = (() => {
  let guides = [];
  const UNITS = { h: 'Kč/h', m2: 'Kč/m²', ks: 'Kč/ks' };

  const set = (list) => { guides = list || []; };

  /** Záznamy pro kategorii: nejbližší nahoru ve stromu, nejvýš po jednom na jednotku (max. 2). */
  function forCategory(categoryId) {
    const out = [];
    const seen = new Set();
    for (const c of Tree.path(categoryId).reverse()) {
      for (const g of guides.filter((x) => x.category_id === c.id)) {
        if (seen.has(g.unit)) continue;
        seen.add(g.unit);
        out.push({ ...g, fromCategory: c });
      }
    }
    return out.slice(0, 2);
  }

  const num = (v) => formatNum(v);
  const unitLabel = (u) => UNITS[u] || 'Kč';
  const range = (min, max, suffix = '') => (max != null && max !== min ? `${num(min)}–${num(max)}` : num(min)) + suffix;

  /** Jedna věta s rozpětím: „700–1 200 Kč/h + výjezd 200–400 Kč; práce zpravidla 1–2 h, celkem cca 1 000–3 000 Kč“. */
  function sentence(g) {
    const u = unitLabel(g.unit);
    let s = g.max_czk != null ? `${num(g.min_czk)}–${num(g.max_czk)} ${u}` : `od cca ${num(g.min_czk)} ${u}`;
    const hasCallout = g.callout_min_czk != null;
    if (hasCallout) s += ` + výjezd ${range(g.callout_min_czk, g.callout_max_czk, ' Kč')}`;
    else if (g.unit === 'h') s += ' + výjezd';
    const hasHours = g.typical_hours_min != null && g.typical_hours_max != null;
    if (hasHours) {
      s += `; práce zpravidla ${range(g.typical_hours_min, g.typical_hours_max, ' h')}`;
      if (g.unit === 'h' && g.max_czk != null) {
        const lo = g.min_czk * g.typical_hours_min + (g.callout_min_czk || 0);
        const hi = g.max_czk * g.typical_hours_max + (g.callout_max_czk ?? g.callout_min_czk ?? 0);
        s += `, celkem cca ${num(lo)}–${num(hi)} Kč`;
      }
    }
    return s;
  }

  function emergency(g) {
    if (g.emergency_surcharge_pct_min == null) return '';
    const max = g.emergency_surcharge_pct_max;
    const pct = max != null && max !== g.emergency_surcharge_pct_min
      ? `${g.emergency_surcharge_pct_min}–${max} %` : `${g.emergency_surcharge_pct_min} %`;
    return `Při havárii mimo běžnou dobu bývá příplatek ${pct}.`;
  }

  /** HTML bloku „Orientační odhad“. Nikdy nezobrazí jediné číslo bez rozpětí / „od cca“. */
  function html(categoryId) {
    if (!categoryId || !Tree.get(categoryId)) return '';
    const recs = forCategory(categoryId);
    const name = esc(Tree.get(categoryId).name);
    const shell = (inner) => `
      <section class="estimate" aria-labelledby="est-title">
        <h3 id="est-title">Orientační odhad <span class="pill">ilustrativní údaje</span></h3>
        <p class="est-for">Pro: <strong>${name}</strong></p>
        ${inner}
      </section>`;

    if (!recs.length) {
      return shell('<p class="est-none"><strong>Cenu vám řemeslník upřesní po poptávce.</strong></p>');
    }

    const items = recs.map((g) => {
      const unknown = g.unit === 'h' && g.callout_min_czk == null && g.typical_hours_min == null
        ? ' Výjezd a rozsah práce záleží na konkrétní zakázce.' : '';
      return `
        <li>
          <p class="est-rate">${sentence(g)}</p>
          ${g.note ? `<p class="est-note">${esc(g.note)}${unknown}</p>` : (unknown ? `<p class="est-note">${unknown.trim()}</p>` : '')}
          ${emergency(g) ? `<p class="est-note">${esc(emergency(g))}</p>` : ''}
        </li>`;
    }).join('');

    const source = recs[0].source;
    return shell(`
      <ul class="est-list">${items}</ul>
      <details class="est-more">
        <summary>Co cenu ovlivní</summary>
        <ul>
          <li>rozsah a složitost práce, přístup na místo,</li>
          <li>potřebný materiál a náhradní díly,</li>
          <li>vzdálenost a výjezd řemeslníka,</li>
          <li>naléhavost (večer, víkend, havárie),</li>
          <li>region – v okrese bývají ceny nižší než v Praze.</li>
        </ul>
      </details>
      <p class="est-disclaimer"><strong>Je to jen orientační rozpětí.</strong> Konečnou cenu určuje řemeslník po upřesnění zakázky.</p>
      ${source ? `<p class="est-source">Zdroj: ${esc(source)}</p>` : ''}`);
  }

  return { set, forCategory, sentence, html };
})();
