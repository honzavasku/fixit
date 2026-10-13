/* ==========================================================================
   address-input.js – pole pro adresu s našeptáváním (combobox)
   --------------------------------------------------------------------------
   AddressInput.attach({ input, list, onPick, onError }) → { getPicked, setPicked, reset }
   Našeptávání (s debounce 300 ms) běží jen s klíčem Mapy.com; s OpenStreetMap
   se nic nenašeptává (Nominatim to zakazuje) a pole funguje jako běžné.
   ========================================================================== */
'use strict';

const AddressInput = (() => {
  function attach({ input, list, onPick = () => {}, onError = () => {} }) {
    let picked = null;
    let items = [];
    let active = -1;
    let controller = null;
    let seq = 0;

    function close() {
      list.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      active = -1;
    }

    function render() {
      if (!items.length) { close(); return; }
      list.innerHTML = items.map((it, i) => `
        <li role="option" id="${list.id}-opt-${i}" data-i="${i}" aria-selected="${i === active}">
          <strong>${esc(it.label)}</strong>${it.secondary ? `<small>${esc(it.secondary)}</small>` : ''}
        </li>`).join('') +
        (Maps.provider === 'mapy' ? `<li class="suggest-credit" role="presentation">${Maps.logoHtml(14)}</li>` : '');
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
    }

    function pick(i) {
      const it = items[i];
      if (!it) return;
      picked = { lat: it.lat, lng: it.lng, label: it.label };
      input.value = it.label;
      close();
      onPick(picked);
    }

    function setActive(i) {
      active = (i + items.length) % items.length;
      $$('[role="option"]', list).forEach((n, k) => n.setAttribute('aria-selected', String(k === active)));
      input.setAttribute('aria-activedescendant', `${list.id}-opt-${active}`);
      const n = $(`#${list.id}-opt-${active}`, list);
      if (n) n.scrollIntoView({ block: 'nearest' });
    }

    const fetchSuggestions = debounce(async (text) => {
      if (!Maps.supportsSuggest || text.trim().length < 2) { items = []; close(); return; }
      if (controller) controller.abort();
      controller = new AbortController();
      const mine = ++seq;
      try {
        const res = await Maps.suggest(text, controller.signal);
        if (mine !== seq) return;
        items = res; active = -1; render();
      } catch (e) {
        if (e.name === 'AbortError') return;
        if (mine !== seq) return;
        items = []; close();
        onError(e instanceof MapsError ? e.userMessage : 'Našeptávání adres se nepodařilo.');
      }
    }, 300);

    input.addEventListener('input', () => {
      picked = null;
      onError('');
      fetchSuggestions(input.value);
    });
    input.addEventListener('keydown', (e) => {
      if (list.hidden) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active < 0 ? items.length - 1 : active - 1); }
      else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(active); }
      else if (e.key === 'Escape') { e.stopPropagation(); close(); }
    });
    input.addEventListener('blur', () => setTimeout(close, 150));
    // mousedown místo click, ať pole neztratí fokus dřív, než se volba zpracuje
    list.addEventListener('mousedown', (e) => {
      const li = e.target.closest('[role="option"]');
      if (li) { e.preventDefault(); pick(parseInt(li.dataset.i, 10)); }
    });

    return {
      getPicked: () => (picked && normalize(picked.label) === normalize(input.value) ? picked : null),
      setPicked(p) { picked = p; },
      reset() { picked = null; items = []; close(); },
    };
  }
  return { attach };
})();
