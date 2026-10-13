/* ==========================================================================
   availability.js – dostupnost řemeslníka
   --------------------------------------------------------------------------
   Data: týdenní okna (availability_rules: weekday 1 = pondělí … 7 = neděle,
   start/end „HH:MM“) a výjimky (availability_exceptions: date „YYYY-MM-DD“,
   isAvailable, note).
     - výjimka isAvailable = false → ten den řemeslník nepracuje,
     - výjimka isAvailable = true  → pracuje (podle týdenních oken; nemá-li pro
       ten den žádné, platí výchozí okno 8:00–16:00).
   nextAvailability(craftsman, now) vrátí nejbližší volné okno jako text.
   ========================================================================== */
'use strict';

const WEEKDAY_NAMES = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota', 'Neděle'];
const DEFAULT_EXCEPTION_WINDOW = { start: 8 * 60, end: 16 * 60 };
const LOOKAHEAD_DAYS = 21;

const isoWeekday = (d) => (d.getDay() === 0 ? 7 : d.getDay());
const pad2 = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const toMinutes = (hhmm) => { const [h, m] = String(hhmm).split(':'); return parseInt(h, 10) * 60 + (parseInt(m, 10) || 0); };
const hhmm = (min) => `${Math.floor(min / 60)}:${pad2(min % 60)}`;
/** 480 → „8“, 570 → „8:30“ */
const shortHour = (min) => (min % 60 ? hhmm(min) : String(Math.floor(min / 60)));
const isNonstop = (w) => w.start === 0 && w.end >= 23 * 60 + 59;

/** Okna řemeslníka pro konkrétní den (v minutách od půlnoci), seřazená. */
function windowsForDate(craftsman, date) {
  const av = craftsman.availability || { rules: [], exceptions: [] };
  const key = ymd(date);
  const ex = (av.exceptions || []).find((e) => e.date === key);
  if (ex && !ex.isAvailable) return [];
  let wins = (av.rules || [])
    .filter((r) => r.weekday === isoWeekday(date))
    .map((r) => ({ start: toMinutes(r.start), end: toMinutes(r.end) }))
    .filter((w) => w.end > w.start)
    .sort((a, b) => a.start - b.start);
  if (ex && ex.isAvailable && !wins.length) wins = [{ ...DEFAULT_EXCEPTION_WINDOW }];
  return wins;
}

function describeWindow(w) {
  return isNonstop(w) ? 'nonstop' : `${shortHour(w.start)}–${shortHour(w.end)}`;
}

/**
 * Nejbližší volný termín. Vrací:
 *   { text, today, minutesFromNow }
 *   text: „Dnes volný do 16:00“, „Dnes po 16:00“, „Zítra 8–12“, „Pondělí 8–16“, „Pondělí 26. 10. 8–16“
 *   today: volný ještě dnes (okno právě běží, nebo začíná později dnes)
 *   minutesFromNow: pro řazení (0 = volný hned, Infinity = bez termínu)
 */
function nextAvailability(craftsman, now = new Date()) {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  for (let d = 0; d < LOOKAHEAD_DAYS; d++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
    const wins = windowsForDate(craftsman, date);
    for (const w of wins) {
      if (d === 0 && w.end <= nowMin) continue;
      if (d === 0) {
        const running = w.start <= nowMin;
        const text = running
          ? (isNonstop(w) ? 'Dnes nonstop' : `Dnes volný do ${hhmm(w.end)}`)
          : `Dnes po ${hhmm(w.start)}`;
        return { text, today: true, minutesFromNow: running ? 0 : w.start - nowMin };
      }
      const minutesFromNow = d * 1440 + w.start - nowMin;
      const range = describeWindow(w);
      let text;
      if (d === 1) text = `Zítra ${range}`;
      else if (d < 7) text = `${WEEKDAY_NAMES[isoWeekday(date) - 1]} ${range}`;
      else text = `${WEEKDAY_NAMES[isoWeekday(date) - 1]} ${date.getDate()}. ${date.getMonth() + 1}. ${range}`;
      return { text, today: false, minutesFromNow };
    }
  }
  return { text: 'Termín domluvou', today: false, minutesFromNow: Infinity };
}

/* ==========================================================================
   Jednoduchý editor: týdenní okna + výjimky (pro „Můj profil“)
   ========================================================================== */
const AvailabilityEditor = (() => {
  function mount(root, initial = {}) {
    const state = {
      rules: (initial.rules || []).map((r) => ({ weekday: r.weekday, start: r.start, end: r.end })),
      exceptions: (initial.exceptions || []).map((e) => ({ date: e.date, isAvailable: !!e.isAvailable, note: e.note || '' })),
    };

    function rowsFor(weekday) {
      return state.rules
        .map((r, i) => ({ r, i }))
        .filter(({ r }) => r.weekday === weekday)
        .sort((a, b) => toMinutes(a.r.start) - toMinutes(b.r.start));
    }

    function render() {
      const week = WEEKDAY_NAMES.map((name, idx) => {
        const weekday = idx + 1;
        const wins = rowsFor(weekday);
        return `
          <div class="av-day" role="group" aria-label="${name}">
            <div class="av-day-name">${name}</div>
            <div class="av-wins">
              ${wins.length ? wins.map(({ r, i }) => `
                <div class="av-win">
                  <label class="sr-only" for="av-s-${i}">${name}: od</label>
                  <input type="time" id="av-s-${i}" data-rule="${i}" data-field="start" value="${esc(r.start)}" step="900">
                  <span aria-hidden="true">–</span>
                  <label class="sr-only" for="av-e-${i}">${name}: do</label>
                  <input type="time" id="av-e-${i}" data-rule="${i}" data-field="end" value="${esc(r.end)}" step="900">
                  <button type="button" class="icon-btn icon-btn-sm" data-av="del-rule" data-i="${i}" aria-label="Odebrat okno ${name} ${esc(r.start)}–${esc(r.end)}">✕</button>
                </div>`).join('') : '<span class="muted av-off">nepracuji</span>'}
            </div>
            <button type="button" class="link-btn av-add" data-av="add-rule" data-weekday="${weekday}">+ okno</button>
          </div>`;
      }).join('');

      const ex = state.exceptions
        .map((e, i) => ({ e, i }))
        .sort((a, b) => a.e.date.localeCompare(b.e.date))
        .map(({ e, i }) => `
          <li class="av-ex">
            <label class="sr-only" for="ex-d-${i}">Datum výjimky</label>
            <input type="date" id="ex-d-${i}" data-ex="${i}" data-field="date" value="${esc(e.date)}">
            <label class="sr-only" for="ex-a-${i}">Typ výjimky</label>
            <select id="ex-a-${i}" data-ex="${i}" data-field="isAvailable">
              <option value="0"${e.isAvailable ? '' : ' selected'}>Nepracuji</option>
              <option value="1"${e.isAvailable ? ' selected' : ''}>Pracuji (8–16, nebo podle týdne)</option>
            </select>
            <label class="sr-only" for="ex-n-${i}">Poznámka</label>
            <input type="text" id="ex-n-${i}" data-ex="${i}" data-field="note" value="${esc(e.note)}" placeholder="Poznámka (nepovinná)" maxlength="80">
            <button type="button" class="icon-btn icon-btn-sm" data-av="del-ex" data-i="${i}" aria-label="Odebrat výjimku ${esc(e.date)}">✕</button>
          </li>`).join('');

      root.innerHTML = `
        <h4 class="av-title">Týdenní okna</h4>
        <p class="help">Kdy obvykle pracujete. Můžete přidat víc oken za den (např. ráno a večer).</p>
        <div class="av-week">${week}</div>
        <h4 class="av-title">Výjimky</h4>
        <p class="help">Dovolená, nemoc nebo naopak jednorázově navíc pracovní den.</p>
        <ul class="av-exs">${ex || '<li class="muted">Žádné výjimky.</li>'}</ul>
        <button type="button" class="btn btn-secondary btn-sm" data-av="add-ex">+ Přidat výjimku</button>
        <p class="av-preview" aria-live="polite"></p>
        <p class="error" data-av-error role="alert" hidden></p>`;
      updatePreview();
    }

    function updatePreview() {
      const p = $('.av-preview', root);
      if (!p) return;
      const next = nextAvailability({ availability: { rules: validRules(), exceptions: validExceptions() } });
      p.innerHTML = `Takto se klientům zobrazí nejbližší termín: <strong>${esc(next.text)}</strong>`;
    }

    const validRules = () => state.rules.filter((r) => r.start && r.end && toMinutes(r.end) > toMinutes(r.start));
    const validExceptions = () => state.exceptions.filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date));

    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-av]');
      if (!b) return;
      const act = b.dataset.av;
      if (act === 'add-rule') {
        const weekday = parseInt(b.dataset.weekday, 10);
        const last = rowsFor(weekday).pop();
        state.rules.push(last ? { weekday, start: '16:00', end: '19:00' } : { weekday, start: '08:00', end: '16:00' });
        render();
      } else if (act === 'del-rule') {
        state.rules.splice(parseInt(b.dataset.i, 10), 1);
        render();
      } else if (act === 'add-ex') {
        const d = new Date(); d.setDate(d.getDate() + 1);
        state.exceptions.push({ date: ymd(d), isAvailable: false, note: '' });
        render();
      } else if (act === 'del-ex') {
        state.exceptions.splice(parseInt(b.dataset.i, 10), 1);
        render();
      }
    });

    root.addEventListener('input', (e) => {
      const t = e.target;
      if (t.dataset.rule != null) state.rules[parseInt(t.dataset.rule, 10)][t.dataset.field] = t.value;
      else if (t.dataset.ex != null) {
        const ex = state.exceptions[parseInt(t.dataset.ex, 10)];
        ex[t.dataset.field] = t.dataset.field === 'isAvailable' ? t.value === '1' : t.value;
      } else return;
      const err = $('[data-av-error]', root);
      if (err) err.hidden = true;
      updatePreview();
    });

    render();

    return {
      /** { rules, exceptions } nebo vyhodí Error s českou hláškou. */
      getValue() {
        const bad = state.rules.find((r) => !r.start || !r.end || toMinutes(r.end) <= toMinutes(r.start));
        if (bad) throw new Error(`${WEEKDAY_NAMES[bad.weekday - 1]}: konec okna musí být později než začátek.`);
        const badEx = state.exceptions.find((x) => !/^\d{4}-\d{2}-\d{2}$/.test(x.date));
        if (badEx) throw new Error('U každé výjimky vyplňte datum.');
        const seen = new Set();
        for (const x of state.exceptions) {
          if (seen.has(x.date)) throw new Error(`Pro datum ${x.date} máte víc výjimek – nechte jen jednu.`);
          seen.add(x.date);
        }
        return {
          rules: state.rules.map((r) => ({ ...r })),
          exceptions: state.exceptions.map((x) => ({ ...x, note: x.note.trim() })),
        };
      },
      showError(msg) {
        const err = $('[data-av-error]', root);
        if (err) { err.textContent = msg; err.hidden = !msg; }
      },
    };
  }
  return { mount };
})();
