/* ==========================================================================
   pages.js – stránky #/poplatky, #/registrace-remeslnika a #/profil
   --------------------------------------------------------------------------
   Pages.fees(root)
   Pages.register(root, ctx)
   Pages.profile(root, ctx)
   ctx = { ds, craftsmen(), favorites(), reload(), navigate(hash), openChat(c) }
   ========================================================================== */
'use strict';

const Pages = (() => {
  const FEE_CONTACT = 100;   // Kč za odemčený kontakt (poptávku)
  const FEE_PREMIUM = 299;   // Kč měsíčně, volitelný prémiový profil

  const czk = (n) => `${formatNum(Math.round(n))} Kč`;

  /* ======================================================================
     #/poplatky
     ====================================================================== */
  function fees(root) {
    root.innerHTML = `
      <div class="page-inner">
        <h1 id="fees-title">Ceník poplatků</h1>
        <p class="note-box"><strong>Návrh ceníku v rámci školního projektu, ne závazné ceny.</strong> Nic se tu neplatí ani nevybírá.</p>

        <div class="fee-grid">
          <article class="fee-card fee-free">
            <h2>Klient</h2>
            <p class="fee-price">Zdarma</p>
            <ul>
              <li>hledání řemeslníků a srovnání na mapě</li>
              <li>orientační odhad ceny</li>
              <li>zprávy řemeslníkům</li>
            </ul>
          </article>
          <article class="fee-card">
            <h2>Odemčený kontakt</h2>
            <p class="fee-price">${czk(FEE_CONTACT)} <small>za poptávku</small></p>
            <ul>
              <li>platíte jen za poptávku, kterou si odemknete</li>
              <li>kontakt a podrobnosti zakázky od klienta</li>
              <li>bez měsíčního závazku</li>
            </ul>
          </article>
          <article class="fee-card fee-premium">
            <h2>Prémiový profil <span class="pill">volitelný</span></h2>
            <p class="fee-price">${czk(FEE_PREMIUM)} <small>měsíčně</small></p>
            <ul>
              <li>odznak Premium a výraznější karta v seznamu</li>
              <li>přednost při stejné vzdálenosti (návrh)</li>
              <li>přehled zobrazení profilu (návrh)</li>
            </ul>
          </article>
        </div>

        <section class="calc" aria-labelledby="calc-title">
          <h2 id="calc-title">Kalkulačka pro řemeslníky</h2>
          <form id="calc-form" novalidate>
            <label for="calc-contacts" class="calc-label">Kolik kontaktů měsíčně si odemknete?</label>
            <div class="calc-row">
              <input type="range" id="calc-range" min="0" max="60" step="1" value="8" aria-label="Počet kontaktů měsíčně (posuvník)">
              <input type="number" id="calc-contacts" min="0" max="500" step="1" value="8" inputmode="numeric">
            </div>
            <label class="check-line"><input type="checkbox" id="calc-premium"> Chci i prémiový profil (${czk(FEE_PREMIUM)} měsíčně)</label>
          </form>
          <output id="calc-out" class="calc-out" for="calc-contacts calc-premium" aria-live="polite"></output>
        </section>

        <section class="faq" aria-labelledby="faq-title">
          <h2 id="faq-title">Časté otázky</h2>
          <details><summary>Platí něco klient?</summary><p>Ne. Hledání, srovnání i psaní zpráv je pro klienty zdarma.</p></details>
          <details><summary>Co znamená „odemčený kontakt“?</summary><p>Řemeslník zaplatí ${czk(FEE_CONTACT)} za to, že uvidí kontakt a podrobnosti konkrétní poptávky. Do té doby vidí jen stručné informace (obor, obec).</p></details>
          <details><summary>Platí se za zobrazení profilu v seznamu?</summary><p>V návrhu ne. Profil v seznamu je zdarma, platí se až za odemčení poptávky.</p></details>
          <details><summary>K čemu je prémiový profil?</summary><p>Je to volitelné zvýraznění: odznak, výraznější karta a přednost při stejné vzdálenosti. Odemčené kontakty se platí zvlášť.</p></details>
          <details><summary>Jsou ceny závazné?</summary><p>Ne. Jde o návrh ceníku v rámci školního projektu (Základy podnikání). Částky se můžou při dalším vývoji změnit.</p></details>
        </section>
      </div>`;

    const range = $('#calc-range', root);
    const num = $('#calc-contacts', root);
    const prem = $('#calc-premium', root);
    const out = $('#calc-out', root);

    function update() {
      const n = Math.max(0, Math.min(500, parseInt(num.value, 10) || 0));
      const contacts = n * FEE_CONTACT;
      const premium = prem.checked ? FEE_PREMIUM : 0;
      const total = contacts + premium;
      const perContact = n > 0 && premium ? `<p class="muted">S prémiovým profilem vychází cca ${czk(total / n)} na jeden kontakt.</p>` : '';
      out.innerHTML = `
        <p class="calc-total"><strong>${czk(total)}</strong> <span>měsíčně</span></p>
        <ul class="calc-lines">
          <li>${n} ${plural(n, ['kontakt', 'kontakty', 'kontaktů'])} × ${czk(FEE_CONTACT)} = ${czk(contacts)}</li>
          ${premium ? `<li>prémiový profil = ${czk(premium)}</li>` : ''}
          <li>za rok cca ${czk(total * 12)}</li>
        </ul>${perContact}
        <p class="muted">Odhad nákladů podle návrhu ceníku, ne závazná cena.</p>`;
    }
    range.addEventListener('input', () => { num.value = range.value; update(); });
    num.addEventListener('input', () => { range.value = Math.min(60, parseInt(num.value, 10) || 0); update(); });
    prem.addEventListener('change', update);
    $('#calc-form', root).addEventListener('submit', (e) => e.preventDefault());
    update();
  }

  /* ======================================================================
     Formulář profilu řemeslníka (sdílený: registrace i profil)
     ====================================================================== */
  function checklistHtml(selected) {
    const sel = new Set(selected || []);
    return Tree.children(null).map((root) => {
      const groups = Tree.children(root.id);
      const open = groups.some((g) => sel.has(g.id) || Tree.children(g.id).some((l) => sel.has(l.id)));
      return `
        <details class="chk-root"${open ? ' open' : ''}>
          <summary>${iconSvg(root.icon, 18)} ${esc(root.name)}</summary>
          <div class="chk-groups">
            ${groups.map((g) => `
              <div class="chk-group">
                <label class="chk"><input type="checkbox" name="cat" value="${esc(g.id)}"${sel.has(g.id) ? ' checked' : ''}> <strong>${esc(g.name)}</strong></label>
                <div class="chk-leaves">
                  ${Tree.children(g.id).map((l) => `<label class="chk"><input type="checkbox" name="cat" value="${esc(l.id)}"${sel.has(l.id) ? ' checked' : ''}> ${esc(l.name)}</label>`).join('')}
                </div>
              </div>`).join('')}
          </div>
        </details>`;
    }).join('');
  }

  function profileFormHtml(v, idp) {
    return `
      <div class="form-row">
        <label for="${idp}-name">Jméno nebo název (zobrazí se klientům)</label>
        <input id="${idp}-name" name="name" type="text" maxlength="60" value="${esc(v.name || '')}" autocomplete="name" required>
      </div>
      <div class="form-row">
        <label for="${idp}-role">Označení řemesla <small>(např. Instalatér, Elektrikář)</small></label>
        <input id="${idp}-role" name="role" type="text" maxlength="60" value="${esc(v.role || '')}" required>
      </div>
      <fieldset class="form-row">
        <legend>Obory, ve kterých pracujete</legend>
        <div class="chk-wrap" id="${idp}-cats">${checklistHtml(v.categoryIds)}</div>
        <p class="help">Vyberte aspoň jeden. Můžete zvolit celou skupinu (např. „Voda a odpady“), nebo jen konkrétní práce.</p>
      </fieldset>
      <div class="form-row">
        <label for="${idp}-town">Obec</label>
        <input id="${idp}-town" name="town" type="text" maxlength="60" value="${esc(v.town || '')}" autocomplete="address-level2" required>
      </div>
      <div class="form-row">
        <label for="${idp}-addr">Adresa pro umístění na mapě <small>(najdeme souřadnice)</small></label>
        <div class="combo">
          <input id="${idp}-addr" type="text" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false"
                 aria-controls="${idp}-addr-list" placeholder="např. Rakovník, Husovo náměstí 20" aria-describedby="${idp}-addr-help ${idp}-addr-err">
          <ul id="${idp}-addr-list" class="suggest-list" role="listbox" aria-label="Návrhy adres" hidden></ul>
        </div>
        <p id="${idp}-addr-help" class="help">Přesnou polohu klienti neuvidí, jen vzdálenost. <span>${Maps.logoHtml(14)}</span></p>
        <p id="${idp}-addr-err" class="error" role="alert" hidden></p>
        <div class="coords">
          <label>Zeměpisná šířka <input name="lat" type="number" step="any" inputmode="decimal" value="${v.lat ?? ''}"></label>
          <label>Zeměpisná délka <input name="lng" type="number" step="any" inputmode="decimal" value="${v.lng ?? ''}"></label>
          <button type="button" class="btn btn-secondary btn-sm" data-find-coords>Najít podle adresy</button>
        </div>
      </div>
      <div class="form-row">
        <label for="${idp}-desc">Popis služeb</label>
        <textarea id="${idp}-desc" name="description" rows="4" maxlength="500">${esc(v.description || '')}</textarea>
      </div>
      <div class="form-row form-row-narrow">
        <label for="${idp}-rate">Hodinová sazba <small>(Kč/h, nepovinné)</small></label>
        <input id="${idp}-rate" name="hourlyRate" type="number" min="0" max="10000" step="10" inputmode="numeric" value="${v.hourlyRate ?? ''}">
      </div>
      <div class="form-row two-col">
        <div><label for="${idp}-phone">Telefon <small>(nepovinné)</small></label>
          <input id="${idp}-phone" name="phone" type="tel" maxlength="30" value="${esc(v.phone || '')}" autocomplete="tel"></div>
        <div><label for="${idp}-email">Kontaktní e-mail <small>(nepovinné)</small></label>
          <input id="${idp}-email" name="email" type="email" maxlength="80" value="${esc(v.email || '')}" autocomplete="email"></div>
      </div>
      <p class="help">Kontakt se klientům zobrazí až po odemčení poptávky (návrh, viz <a href="#/poplatky">ceník poplatků</a>).</p>`;
  }

  /** Naváže na formulář adresu/souřadnice a vrátí funkci, která formulář přečte (nebo vyhodí Error). */
  function bindProfileForm(form, idp) {
    const addr = $(`#${idp}-addr`, form);
    const err = $(`#${idp}-addr-err`, form);
    const lat = form.elements.lat;
    const lng = form.elements.lng;
    const town = form.elements.town;
    const showErr = (msg) => { err.textContent = msg; err.hidden = !msg; };

    AddressInput.attach({
      input: addr, list: $(`#${idp}-addr-list`, form), onError: showErr,
      onPick(p) {
        lat.value = p.lat.toFixed(5); lng.value = p.lng.toFixed(5);
        if (!town.value.trim()) town.value = p.label.split(',')[0].trim();
      },
    });

    $('[data-find-coords]', form).addEventListener('click', async (e) => {
      const text = addr.value.trim() || town.value.trim();
      if (!text) { showErr('Napište adresu nebo obec.'); return; }
      const btn = e.currentTarget;
      btn.disabled = true;
      try {
        const g = await Maps.geocode(text);
        if (!g) { showErr('Adresu se nepodařilo najít. Zkuste ji napsat jinak, nebo zadejte souřadnice ručně.'); return; }
        showErr('');
        lat.value = g.lat.toFixed(5); lng.value = g.lng.toFixed(5);
      } catch (ex) {
        showErr(ex instanceof MapsError ? ex.userMessage : 'Vyhledání adresy se nepodařilo.');
      } finally { btn.disabled = false; }
    });

    return function read() {
      const f = form.elements;
      const cats = $$('input[name="cat"]:checked', form).map((i) => i.value);
      const data = {
        name: f.name.value.trim(), role: f.role.value.trim(), town: f.town.value.trim(),
        lat: parseFloat(f.lat.value), lng: parseFloat(f.lng.value),
        description: f.description.value.trim(),
        hourlyRate: f.hourlyRate.value === '' ? null : parseInt(f.hourlyRate.value, 10),
        phone: f.phone.value.trim(), email: f.email.value.trim(), categoryIds: cats,
      };
      if (!data.name) throw Object.assign(new Error('Vyplňte jméno nebo název.'), { field: f.name });
      if (!data.role) throw Object.assign(new Error('Vyplňte označení řemesla.'), { field: f.role });
      if (!cats.length) throw Object.assign(new Error('Vyberte aspoň jeden obor.'), { field: $('input[name="cat"]', form) });
      if (!data.town) throw Object.assign(new Error('Vyplňte obec.'), { field: f.town });
      if (!Number.isFinite(data.lat) || !Number.isFinite(data.lng)) {
        throw Object.assign(new Error('Doplňte polohu: vyberte adresu, nebo klikněte na „Najít podle adresy“.'), { field: addr });
      }
      if (data.lat < 48 || data.lat > 51.2 || data.lng < 12 || data.lng > 18.9) {
        throw Object.assign(new Error('Poloha je mimo Česko. Zkontrolujte souřadnice.'), { field: f.lat });
      }
      if (data.hourlyRate != null && (data.hourlyRate < 0 || data.hourlyRate > 10000)) {
        throw Object.assign(new Error('Hodinová sazba musí být mezi 0 a 10 000 Kč.'), { field: f.hourlyRate });
      }
      if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        throw Object.assign(new Error('Zadejte platný kontaktní e-mail.'), { field: f.email });
      }
      return data;
    };
  }

  const loginPrompt = (title, text, mode, role) => `
    <div class="page-inner page-narrow">
      <h1 id="${title.id}">${esc(title.text)}</h1>
      <div class="note-box">
        <p>${text}</p>
        <p class="btn-row">
          <button type="button" class="btn btn-primary" data-open-auth="${mode}" data-role="${role || ''}">${mode === 'register' ? 'Vytvořit účet řemeslníka' : 'Přihlásit se'}</button>
          ${mode === 'register' ? '<button type="button" class="btn btn-secondary" data-open-auth="login">Už mám účet</button>' : ''}
        </p>
      </div>
    </div>`;

  function bindAuthButtons(root) {
    $$('[data-open-auth]', root).forEach((b) => b.addEventListener('click', () => {
      Auth.open(b.dataset.openAuth, { role: b.dataset.role || undefined, opener: b });
    }));
  }

  /* ======================================================================
     #/registrace-remeslnika
     ====================================================================== */
  async function register(root, ctx) {
    const user = Auth.user();
    if (!user) {
      root.innerHTML = loginPrompt({ id: 'register-title', text: 'Registrace řemeslníka' },
        'Získejte nové zakázky ve svém okolí. Nejdřív si vytvořte účet, pak vyplníte obory, polohu a popis. Zakládání účtu i profil jsou zdarma, platí se až odemčený kontakt (návrh, viz <a href="#/poplatky">ceník poplatků</a>).',
        'register', 'craftsman');
      bindAuthButtons(root);
      return;
    }
    if (user.role !== 'craftsman') {
      root.innerHTML = `
        <div class="page-inner page-narrow">
          <h1 id="register-title">Registrace řemeslníka</h1>
          <div class="note-box">
            <p>Jste přihlášeni jako <strong>klient</strong> (${esc(user.email)}). Chcete tento účet přepnout na účet řemeslníka?</p>
            <p class="btn-row"><button type="button" class="btn btn-primary" id="switch-role">Přepnout na účet řemeslníka</button></p>
            <p class="error" id="switch-err" role="alert" hidden></p>
          </div>
        </div>`;
      $('#switch-role', root).addEventListener('click', async (e) => {
        e.currentTarget.disabled = true;
        try { await ctx.ds.auth.setRole(user.id, 'craftsman'); }
        catch (err) { const n = $('#switch-err', root); n.textContent = authErrorMessage(err); n.hidden = false; e.currentTarget.disabled = false; return; }
        ctx.refreshUser();
      });
      return;
    }

    let mine = null;
    try { mine = await ctx.ds.craftsman.getMine(user.id); } catch (e) { console.warn(e); }
    if (mine) {
      root.innerHTML = `
        <div class="page-inner page-narrow">
          <h1 id="register-title">Registrace řemeslníka</h1>
          <div class="note-box"><p>Profil už máte vyplněný. Upravit ho a nastavit dostupnost můžete v sekci <a href="#/profil">Můj profil</a>.</p></div>
        </div>`;
      return;
    }

    root.innerHTML = `
      <div class="page-inner page-narrow">
        <h1 id="register-title">Registrace řemeslníka</h1>
        <p class="lead-left">Vyplňte základní údaje. Dostupnost (kdy můžete přijet) nastavíte hned potom v sekci Můj profil.</p>
        <form id="reg-form" class="panel" novalidate>
          ${profileFormHtml({ name: user.displayName }, 'reg')}
          <p id="reg-error" class="error" role="alert" hidden></p>
          <button type="submit" class="btn btn-primary btn-xl">Vytvořit profil</button>
        </form>
      </div>`;
    const form = $('#reg-form', root);
    const read = bindProfileForm(form, 'reg');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = $('#reg-error', root);
      errEl.hidden = true;
      let data;
      try { data = read(); } catch (ex) { errEl.textContent = ex.message; errEl.hidden = false; ex.field?.focus(); return; }
      const btn = $('button[type=submit]', form);
      btn.disabled = true;
      try {
        await ctx.ds.craftsman.saveMine(user.id, data);
        await ctx.reload();
        toast('Profil byl vytvořen. Nastavte ještě dostupnost.', 'ok');
        ctx.navigate('#/profil');
      } catch (ex) {
        errEl.textContent = ex.userMessage || 'Profil se nepodařilo uložit. Zkuste to znovu.';
        errEl.hidden = false;
        console.warn(ex);
      } finally { btn.disabled = false; }
    });
  }

  /* ======================================================================
     #/profil
     ====================================================================== */
  async function profile(root, ctx) {
    const user = Auth.user();
    if (!user) {
      root.innerHTML = loginPrompt({ id: 'profile-title', text: 'Můj profil' },
        'Pro zobrazení profilu se prosím přihlaste.', 'login');
      bindAuthButtons(root);
      return;
    }
    if (user.role === 'craftsman') return craftsmanProfile(root, ctx, user);
    return clientProfile(root, ctx, user);
  }

  function clientProfile(root, ctx, user) {
    const favs = ctx.craftsmen().filter((c) => ctx.favorites().has(c.id));
    root.innerHTML = `
      <div class="page-inner page-narrow">
        <h1 id="profile-title">Můj účet</h1>
        <div class="panel">
          <p><strong>${esc(user.displayName)}</strong><br><span class="muted">${esc(user.email)} · klient</span></p>
        </div>
        <h2 class="page-h2">Oblíbení řemeslníci</h2>
        ${favs.length ? `<ul class="fav-list">${favs.map((c) => `
          <li class="panel fav-item">
            <img class="avatar" src="${avatarUri(c.name, c.id)}" width="48" height="48" alt="">
            <div class="fav-main"><strong>${esc(c.name)}</strong><br><span class="muted">${esc(c.role)} · ${esc(c.town)}</span></div>
            <button type="button" class="btn btn-primary btn-sm" data-chat="${esc(c.id)}">Napsat zprávu</button>
            <button type="button" class="btn btn-secondary btn-sm" data-unfav="${esc(c.id)}">Odebrat</button>
          </li>`).join('')}</ul>`
          : '<p class="muted">Zatím žádní. U řemeslníků ve výsledcích hledání klikněte na srdíčko.</p>'}
        <p class="btn-row"><a class="btn btn-secondary" href="#/registrace-remeslnika">Chci nabízet služby jako řemeslník</a></p>
      </div>`;
    $$('[data-chat]', root).forEach((b) => b.addEventListener('click', () => {
      const c = ctx.craftsmen().find((x) => x.id === b.dataset.chat);
      if (c) ctx.openChat(c, b);
    }));
    $$('[data-unfav]', root).forEach((b) => b.addEventListener('click', async () => {
      await ctx.toggleFavorite(b.dataset.unfav);
      clientProfile(root, ctx, user);
    }));
  }

  async function craftsmanProfile(root, ctx, user) {
    root.innerHTML = '<div class="page-inner page-narrow"><h1 id="profile-title">Můj profil</h1><p class="muted">Načítám…</p></div>';
    let mine = null;
    try { mine = await ctx.ds.craftsman.getMine(user.id); }
    catch (e) {
      console.warn(e);
      root.innerHTML = '<div class="page-inner page-narrow"><h1 id="profile-title">Můj profil</h1><p class="error" role="alert">Profil se nepodařilo načíst. Zkuste stránku obnovit.</p></div>';
      return;
    }
    if (!mine) {
      root.innerHTML = `
        <div class="page-inner page-narrow">
          <h1 id="profile-title">Můj profil</h1>
          <div class="note-box"><p>Profil řemeslníka ještě nemáte vytvořený.</p>
          <p class="btn-row"><a class="btn btn-primary" href="#/registrace-remeslnika">Dokončit registraci řemeslníka</a></p></div>
        </div>`;
      return;
    }

    const next = nextAvailability(mine);
    root.innerHTML = `
      <div class="page-inner page-narrow">
        <h1 id="profile-title">Můj profil</h1>
        <p class="lead-left">Přihlášeni jako <strong>${esc(user.email)}</strong>. Změny se klientům projeví po uložení.</p>
        ${mine.verified ? '' : '<p class="note-box">Profil zatím není ověřený. Ověření totožnosti a živnosti je v tomto prototypu jen ukázka.</p>'}
        <form id="prof-form" class="panel" novalidate>
          <h2 class="page-h2">Údaje a obory</h2>
          ${profileFormHtml(mine, 'prof')}
          <h2 class="page-h2">Dostupnost</h2>
          <p class="help">Teď: <strong>${esc(next.text)}</strong></p>
          <div id="av-editor" class="av-editor"></div>
          <p id="prof-error" class="error" role="alert" hidden></p>
          <button type="submit" class="btn btn-primary btn-xl">Uložit profil a dostupnost</button>
        </form>
      </div>`;

    const form = $('#prof-form', root);
    const addrInput = $('#prof-addr', form);
    addrInput.value = '';
    const read = bindProfileForm(form, 'prof');
    const editor = AvailabilityEditor.mount($('#av-editor', root), mine.availability);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = $('#prof-error', root);
      errEl.hidden = true;
      let data, availability;
      try { data = read(); } catch (ex) { errEl.textContent = ex.message; errEl.hidden = false; ex.field?.focus(); return; }
      try { availability = editor.getValue(); } catch (ex) { errEl.textContent = ex.message; errEl.hidden = false; return; }
      const btn = $('button[type=submit]', form);
      btn.disabled = true;
      try {
        await ctx.ds.craftsman.saveMine(user.id, { ...data, availability });
        await ctx.reload();
        toast('Profil byl uložen.', 'ok');
        craftsmanProfile(root, ctx, user);
      } catch (ex) {
        errEl.textContent = ex.userMessage || 'Profil se nepodařilo uložit. Zkuste to znovu.';
        errEl.hidden = false;
        console.warn(ex);
      } finally { btn.disabled = false; }
    });
  }

  /* ======================================================================
     #/ pro roli řemeslník – rozcestník
     ====================================================================== */
  function craftsmanHome(root) {
    root.innerHTML = `
      <div class="page-inner">
        <p class="eyebrow">Pro řemeslníky</p>
        <h1 id="pro-title">Nové zakázky z vašeho okolí</h1>
        <p class="lead-left">Klienti na FixIt popisují problém a my jim ukazujeme nejbližší vhodné řemeslníky. Vy platíte jen za kontakt, který si odemknete.</p>
        <div class="fee-grid">
          <a class="fee-card pro-link" href="#/registrace-remeslnika"><h2>Registrace řemeslníka</h2><p>Vytvořte si účet a vyplňte obory, obec, popis a sazbu.</p></a>
          <a class="fee-card pro-link" href="#/profil"><h2>Můj profil</h2><p>Upravte údaje a nastavte, kdy můžete přijet.</p></a>
          <a class="fee-card pro-link" href="#/poplatky"><h2>Ceník poplatků</h2><p>100 Kč za kontakt, prémiový profil 299 Kč měsíčně (návrh).</p></a>
        </div>
        <p class="muted">Chcete jen najít řemeslníka? Přepněte si roli v záhlaví na „Jsem klient“.</p>
      </div>`;
  }

  return { fees, register, profile, craftsmanHome };
})();
