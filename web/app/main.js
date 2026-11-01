'use strict';

// Kingdom Attendance web app: one link for everyone. Phones enter the PIN, then land on Home; the AV computer
// (and the OBS dock at /desk) also gets the AV desk, the publisher list and Settings. Views register on
// window.AppViews and draw from the live state the AV computer pushes over Server-Sent Events.

(function () {
  const { createApi, pinStore, newTapId } = window.AttendanceApi;
  const UI = window.AppUI;
  const views = (window.AppViews = window.AppViews || {});
  const root = document.getElementById('app');
  const layer = document.getElementById('layer');
  const AV_ONLY = ['desk', 'list', 'setup', 'settings'];

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

  // Redraws the screen, keeping the focused field (and its cursor) so typing isn't interrupted by live updates.
  function draw() {
    const focused = document.activeElement && document.activeElement.id ? document.activeElement : null;
    const caret = focused && typeof focused.selectionStart === 'number' ? [focused.selectionStart, focused.selectionEnd] : null;
    const typing = focused && /^(INPUT|TEXTAREA)$/.test(focused.tagName) && focused.type !== 'file' ? focused.value : null;
    const { name, view, arg } = currentView();
    UI.resetArt();
    if (!pinNeeded && !state) {
      root.innerHTML = '<div class="pad pinpad"><p class="dim" style="text-align:center">Connecting to the AV computer…</p></div>';
      return;
    }
    root.innerHTML = view.render({ state, ctx, arg, pinErr });
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
    draw();
  });

  // One set of listeners for every view: buttons with data-go navigate; the rest goes to the view.
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button, a[data-go]');
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
