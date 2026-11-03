'use strict';

// Kingdom Hall Attendance web app: one link for everyone. Phones enter the PIN, then land on Home; the AV computer
// (and the OBS dock at /desk) also gets the AV desk, the publisher list and Settings. Views register on
// window.AppViews and draw from the live state the AV computer pushes over Server-Sent Events.

(function () {
  const { createApi, pinStore, newTapId } = window.AttendanceApi;
  const UI = window.AppUI;
  const views = (window.AppViews = window.AppViews || {});
  const root = document.getElementById('app');
  const side = document.getElementById('side');
  const layer = document.getElementById('layer');
  const AV_ONLY = ['desk', 'list', 'setup', 'settings'];
  // From 900 px wide (the AV computer's window) the app gets a sidebar; phones and the OBS dock keep their layout.
  const wideQuery = window.matchMedia('(min-width: 900px)');

  let state = null;
  let who = null;
  let live = 'connecting';
  let unsubscribe = null;
  let pinNeeded = false;
  let pinErr = '';
  const memory = {}; // per-view UI memory (search text, filter…) that survives redraws

  const api = createApi({
    getPin: () => pinStore.get(),
    onPinNeeded: () => askPin('Wrong PIN. Check the number shown on the AV computer.'),
  });

  function route() {
    const [name, arg] = location.hash.replace(/^#\/?/, '').split('/');
    return { name: name || 'home', arg };
  }
  const go = (to) => { location.hash = to === 'home' ? '#/' : `#/${to}`; };

  let noteTimer = null;
  function note(text, tone = 'warn') {
    const el = document.getElementById('note');
    el.innerHTML = text ? UI.banner(tone, tone === 'ok' ? 'info' : 'warn', text, '') : '';
    clearTimeout(noteTimer);
    if (text) noteTimer = setTimeout(() => { el.innerHTML = ''; }, 5000);
  }

  // Sends an action; the answer is the new state. Problems show as a calm note, never a crash.
  async function act(path, body = {}) {
    try {
      const next = await api.post(path, body);
      if (next && next.meeting) { state = next; draw(); }
      return next;
    } catch (err) {
      if (err.status !== 401) note(err.message);
      return null;
    }
  }

  const ctx = {
    api, act, go, note, newTapId, layer,
    get state() { return state; },
    get who() { return who; },
    get live() { return live; },
    get wide() { return wideQuery.matches && !!state && !pinNeeded; },
    memory: (name) => (memory[name] = memory[name] || {}),
    redraw: () => draw(),
  };

  function currentView() {
    if (pinNeeded) return { name: 'pin', view: views.pin };
    const r = route();
    // Only once the AV computer has answered "who am I" — a reload on #/settings must not bounce to Home.
    if (AV_ONLY.includes(r.name) && who && !who.local) { go('home'); return { name: 'home', view: views.home }; }
    return { name: r.name, view: views[r.name] || views.home, arg: r.arg };
  }

  // The desktop sidebar: brand, the screens, and the phones' QR code and PIN at the bottom (AV computer only).
  // Rebuilt only when it changes, so live updates don't restart its artwork.
  function drawSide(name) {
    const wide = ctx.wide;
    document.body.classList.toggle('wide', wide);
    side.hidden = !wide;
    if (!wide) return null;
    const av = !!(who && who.local);
    const sb = window.AttendanceModel.sidebar({ av, named: state.mode === 'names', count: state.roster.length, route: name });
    const mem = ctx.memory('side');
    if (sb.pin && (!mem.tried || mem.stale) && !mem.loading) {
      Object.assign(mem, { tried: true, stale: false, loading: true });
      api.get('/api/connect').then((c) => { mem.connect = c; }).catch(() => {}).finally(() => { mem.loading = false; draw(); });
    }
    const c = mem.connect;
    let items = '';
    for (const i of sb.items) {
      if (i.av && i.to === 'desk') items += '<div class="navsep"></div><div class="navlabel">AV computer</div>';
      const badge = i.badge != null ? `<span class="badge">${i.badge}</span>` : '';
      items += `<button class="navi" data-go="${i.go}" ${i.current ? 'aria-current="page"' : ''}>${UI.icon(i.to)}<span>${UI.esc(i.label)}</span>${badge}</button>`;
    }
    const html = `<div class="brand">${UI.disc(window.AttendanceUiArt.markArt)}<div><b>Kingdom Hall Attendance</b><small>${UI.esc(state.congregation || 'Kingdom Hall')}</small></div></div>
      ${sb.addList ? `<button class="addlist" data-go="setup">${UI.icon('plus')}Add publisher list</button>` : ''}
      <nav class="navlist">${items}</nav>
      ${sb.pin && c ? `<div class="sidepin"><img class="qr" src="${c.qr}" alt="QR code that opens Kingdom Hall Attendance on a phone"><div><div class="dim small">Phones · PIN</div><div class="pin st-num">${UI.esc(c.pin)}</div></div></div>` : ''}`;
    if (mem.html !== html) { side.innerHTML = html; mem.html = html; }
    return sb;
  }

  const noListBanner = () => `<div class="nolist" role="status">${UI.icon('info')}<span><b>No publisher list yet.</b> Counting is by Left, Center and Right. Add your list to mark people by name.</span><button class="st-btn st-btn--primary" data-go="setup">Add the list</button></div>`;

  // Redraws the screen, keeping the focused field (and its cursor) so typing isn't interrupted by live updates.
  function draw() {
    const focused = document.activeElement && document.activeElement.id ? document.activeElement : null;
    const caret = focused && typeof focused.selectionStart === 'number' ? [focused.selectionStart, focused.selectionEnd] : null;
    const typing = focused && /^(INPUT|TEXTAREA)$/.test(focused.tagName) && focused.type !== 'file' ? focused.value : null;
    const { name, view, arg } = currentView();
    UI.resetArt();
    const sb = drawSide(name);
    if (!pinNeeded && !state) {
      root.innerHTML = '<div class="pad pinpad"><p class="dim" style="text-align:center">Connecting to the AV computer…</p></div>';
      return;
    }
    root.innerHTML = (sb && sb.noListBanner ? noListBanner() : '') + view.render({ state, ctx, arg, pinErr });
    // The desk's waiting and "Ready" overlays belong to the desk only.
    // Leaving it also forgets its QR code and PIN, so a New PIN made meanwhile shows when it opens again.
    if (name !== 'desk' && root.dataset.view === 'desk') {
      layer.innerHTML = '';
      Object.assign(ctx.memory('desk'), { lastStatus: undefined, connect: null, loadingConnect: false });
    }
    root.dataset.view = name;
    if (state) window.AttendanceAppearance.apply(state.appearance);
    if (focused) {
      const again = document.getElementById(focused.id);
      if (again) {
        // A live update mustn't wipe what's being typed (fields marked data-live show the AV computer's value instead).
        if (typing !== null && !again.hasAttribute('data-live') && again.value !== typing) again.value = typing;
        again.focus();
        if (caret) try { again.setSelectionRange(caret[0], caret[1]); } catch { /* not a text field */ }
      }
    }
    if (view.after) view.after({ root, ctx, arg });
  }

  let lastRoute = '';
  window.addEventListener('hashchange', () => {
    if (location.hash !== lastRoute) window.scrollTo(0, 0);
    lastRoute = location.hash;
    ctx.memory('side').stale = true; // the phones' address can change; fetch the QR code again
    draw();
  });
  wideQuery.addEventListener('change', () => draw());

  side.addEventListener('click', (e) => {
    const b = e.target.closest('[data-go]');
    if (b) go(b.dataset.go);
  });

  // One set of listeners for every view: buttons with data-go navigate; the rest goes to the view.
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button, a[data-go], tr[data-go]');
    if (!b || b.disabled) return;
    if (b.dataset.go) { e.preventDefault(); go(b.dataset.go); return; }
    const { view } = currentView();
    if (view.onClick) view.onClick(b, ctx, e);
  });
  for (const type of ['input', 'change', 'keydown']) {
    root.addEventListener(type, (e) => {
      const { view } = currentView();
      const fn = view[`on${type[0].toUpperCase()}${type.slice(1)}`];
      if (fn) fn(e.target, ctx, e);
    });
  }
  root.addEventListener('submit', (e) => {
    e.preventDefault();
    const { view } = currentView();
    if (view.onSubmit) view.onSubmit(e.target, ctx, e);
  });

  // Dropping a file: the publisher-list screens take it; anywhere else it's ignored (never opens the file).
  const dropZones = (on) => { for (const d of root.querySelectorAll('.drop')) d.classList.toggle('over', on); };
  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    const can = !!currentView().view.onDrop;
    e.dataTransfer.dropEffect = can ? 'copy' : 'none';
    dropZones(can);
  });
  document.addEventListener('dragleave', (e) => { if (!e.relatedTarget) dropZones(false); });
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZones(false);
    const { view } = currentView();
    if (view.onDrop && e.dataTransfer.files[0]) view.onDrop(e.dataTransfer.files[0], ctx);
  });

  function askPin(message = '') {
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    pinStore.clear();
    pinNeeded = true;
    pinErr = message;
    draw();
  }

  ctx.submitPin = (pin) => {
    if (!/^\d{4}$/.test(pin)) { pinErr = 'The PIN is 4 numbers.'; draw(); return; }
    pinStore.set(pin);
    pinNeeded = false;
    pinErr = '';
    connect();
  };

  async function connect() {
    try {
      who = await api.get('/api/whoami');
      if (who.pinRequired && !pinStore.get()) return askPin();
      state = await api.get('/api/state');
    } catch (err) {
      if (err.status === 401) return; // the PIN screen is already showing
      live = 'reconnecting';
      draw();
      setTimeout(connect, 3000);
      return;
    }
    if (location.pathname === '/desk' && !location.hash) go('desk');
    draw();
    unsubscribe = api.subscribe((s) => { state = s; draw(); }, (status) => {
      if (status !== live) { live = status; draw(); }
    });
  }

  draw();
  connect();
})();
