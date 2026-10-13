/* ==========================================================================
   auth.js – přihlášení (okno, stav v hlavičce) nad adaptérem z data-source.js
   --------------------------------------------------------------------------
   Auth.init(ds)              spustí se po výběru zdroje dat
   Auth.user()                přihlášený uživatel { id, email, displayName, role } | null
   Auth.require(reason, fn)   zavolá fn(), když je uživatel přihlášen; jinak
                              otevře přihlášení a fn() zavolá až po úspěchu
   Auth.open(mode, opts)      mode: login | register | forgot | recovery
   Auth.signOut()
   Auth.onChange(cb)          cb(user, event)
   ========================================================================== */
'use strict';

const Auth = (() => {
  let ds = null;
  let current = null;
  let mode = 'login';
  let pending = null;       // akce čekající na přihlášení
  let busy = false;
  const subscribers = [];

  const el = {};

  /* ----------------------------- stav a události ----------------------------- */
  function notify(event) { subscribers.forEach((cb) => cb(current, event)); }

  async function init(dataSource) {
    ds = dataSource;
    current = await ds.auth.getUser().catch((e) => { console.warn('getUser:', e); return null; });
    bind();
    renderHeader();
    ds.auth.onChange((event, user) => {
      current = user;
      renderHeader();
      if (event === 'PASSWORD_RECOVERY') open('recovery');
      notify(event);
    });
  }

  const user = () => current;
  const onChange = (cb) => { subscribers.push(cb); };

  /* ----------------------------- hlavička ----------------------------- */
  function renderHeader() {
    const area = $('#auth-area');
    if (!area) return;
    area.innerHTML = current
      ? `<span class="user-chip" title="${esc(current.email)}"><span class="sr-only">Přihlášen: </span>${esc(current.displayName || current.email)}</span>
         <button type="button" class="btn btn-secondary btn-sm" data-auth="logout">Odhlásit</button>`
      : '<button type="button" class="btn btn-primary btn-sm" data-auth="login">Přihlásit se</button>';
  }

  async function signOut() {
    try {
      await ds.auth.signOut();
      toast('Byli jste odhlášeni.');
    } catch (e) { toast(authErrorMessage(e), 'error'); }
  }

  /* ----------------------------- okno ----------------------------- */
  const TITLES = { login: 'Přihlášení', register: 'Vytvořit účet', forgot: 'Obnova hesla', recovery: 'Nové heslo' };
  const SUBMITS = { login: 'Přihlásit se', register: 'Vytvořit účet', forgot: 'Poslat odkaz pro obnovu', recovery: 'Uložit nové heslo' };

  function setMode(next) {
    mode = next;
    $('#auth-title').textContent = TITLES[mode];
    $('#auth-submit').textContent = SUBMITS[mode];
    $$('#auth-modal [data-for]').forEach((n) => {
      const hide = !n.dataset.for.split(/\s+/).includes(mode);
      // v demo režimu (bez Supabase) se heslo nevyžaduje
      n.hidden = hide || (ds.passwordless && n.hasAttribute('data-password'));
    });
    el.tabs.hidden = mode === 'forgot' || mode === 'recovery';
    $$('#auth-tabs [role="tab"]').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.mode === mode)));
    $('#auth-password').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
    $('#auth-password-label').textContent = mode === 'recovery' ? 'Nové heslo' : 'Heslo';
    showMessage('error', '');
    showMessage('info', '');
  }

  function showMessage(kind, text) {
    const n = kind === 'error' ? $('#auth-error') : $('#auth-info');
    n.textContent = text;
    n.hidden = !text;
  }

  /** opts: { reason, role (předvyplněná role při registraci), then (funkce po přihlášení) } */
  function open(nextMode = 'login', opts = {}) {
    el.form.reset();
    pending = opts.then || null;
    const reason = $('#auth-reason');
    reason.textContent = opts.reason || '';
    reason.hidden = !opts.reason;
    $('#auth-demo-note').hidden = !ds.passwordless;
    if (opts.role) {
      const r = $(`input[name="auth-role"][value="${opts.role}"]`);
      if (r) r.checked = true;
    }
    setMode(nextMode);
    Modal.open(el.modal, { opener: opts.opener || document.activeElement, onClose: () => { if (!current) pending = null; } });
  }

  function require(reason, fn, opener) {
    if (current) { fn(); return; }
    open('login', { reason, then: fn, opener });
  }

  function validate() {
    const email = $('#auth-email').value.trim();
    const password = $('#auth-password').value;
    if (mode !== 'recovery' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Zadejte platnou e-mailovou adresu.';
    if (!ds.passwordless) {
      if (mode === 'login' && !password) return 'Zadejte heslo.';
      if ((mode === 'register' || mode === 'recovery') && password.length < 8) return 'Heslo musí mít alespoň 8 znaků.';
    }
    return '';
  }

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    showMessage('error', ''); showMessage('info', '');
    const problem = validate();
    if (problem) { showMessage('error', problem); return; }

    const email = $('#auth-email').value.trim();
    const password = $('#auth-password').value;
    const btn = $('#auth-submit');
    busy = true; btn.disabled = true;
    try {
      if (mode === 'login') {
        await ds.auth.signIn({ email, password });
        finishLogin('Jste přihlášeni.');
      } else if (mode === 'register') {
        const role = $('input[name="auth-role"]:checked').value;
        const displayName = $('#auth-name').value.trim() || email.split('@')[0];
        const res = await ds.auth.signUp({ email, password, displayName, role });
        if (res.needsConfirmation) {
          pending = null;
          setMode('login');
          showMessage('info', `Poslali jsme potvrzovací e-mail na ${email}. Klikněte na odkaz v něm a pak se přihlaste.`);
        } else {
          finishLogin('Účet byl vytvořen.');
        }
      } else if (mode === 'forgot') {
        await ds.auth.resetPassword(email);
        showMessage('info', 'Pokud k tomuto e-mailu existuje účet, poslali jsme na něj odkaz pro nastavení nového hesla.');
      } else if (mode === 'recovery') {
        await ds.auth.updatePassword(password);
        finishLogin('Heslo bylo změněno.');
      }
    } catch (err) {
      console.warn('Auth:', err);
      showMessage('error', authErrorMessage(err));
    } finally {
      busy = false; btn.disabled = false;
    }
  }

  function finishLogin(message) {
    const then = pending;
    pending = null;
    Modal.close(el.modal);
    toast(message, 'ok');
    if (then) setTimeout(then, 50);
  }

  function bind() {
    el.modal = $('#auth-modal');
    el.form = $('#auth-form');
    el.tabs = $('#auth-tabs');
    el.form.addEventListener('submit', submit);
    el.modal.addEventListener('click', (e) => {
      const b = e.target.closest('[data-mode]');
      if (b) setMode(b.dataset.mode);
    });
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-auth]');
      if (!b) return;
      if (b.dataset.auth === 'login') open('login', { opener: b });
      if (b.dataset.auth === 'logout') signOut();
    });
  }

  /** Znovu načte uživatele (např. po změně role). */
  async function refresh() {
    current = await ds.auth.getUser().catch(() => current);
    renderHeader();
    notify('USER_UPDATED');
  }

  return { init, user, require, open, signOut, onChange, refresh };
})();
