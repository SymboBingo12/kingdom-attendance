'use strict';

// OBS dock (/dock) and the Zoom host's page (/zoom, the same page showing only the Zoom number).

(function () {
  const { createApi, pinStore } = window.AttendanceApi;
  const $ = (id) => document.getElementById(id);
  const zoomOnly = location.pathname === '/zoom';
  if (zoomOnly) document.body.classList.add('zoom-only');

  let state = null;
  let unsubscribe = null;
  const api = createApi({ getPin: pinStore.get, onPinNeeded: () => askPin("That PIN didn't work.") });

  const dateFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

  function render(s) {
    state = s;
    window.AttendanceAppearance.apply(s.appearance);
    const m = s.meeting;
    const [y, mo, d] = m.date.split('-').map(Number);
    $('date').textContent = dateFmt.format(new Date(y, mo - 1, d));
    for (const b of document.querySelectorAll('[data-type]')) b.setAttribute('aria-pressed', String(b.dataset.type === m.type));
    $('parts').textContent = `Left ${m.lanes.left} · Center ${m.lanes.center} · Right ${m.lanes.right}`;
    $('hall').textContent = s.totals.hall;
    $('total').textContent = s.totals.total;
    const zoom = $('zoom');
    if (document.activeElement !== zoom) zoom.value = String(m.zoom);
    zoom.disabled = m.finalized;

    const rendering = s.render.status === 'rendering';
    $('finalize').textContent = m.finalized ? 'Unlock' : 'Finalize';
    $('finalize').classList.toggle('primary', !m.finalized);
    $('finalize').disabled = rendering;
    $('rerender').hidden = !m.finalized;
    $('rerender').disabled = rendering;

    const st = $('status');
    st.hidden = s.render.status === 'idle' && !m.finalized;
    st.dataset.s = s.render.status;
    $('statusText').textContent = s.render.message || (m.finalized ? 'Finalized. Numbers saved to history.' : '');
    $('statusWhere').textContent = s.render.savedTo || '';
    if (zoomOnly && m.finalized) setMsg('Finalized. Ask the AV desk to unlock to change it.', '');
  }

  function setMsg(text, kind) {
    $('zoomMsg').textContent = text;
    $('zoomMsg').className = `msg ${kind}`;
  }

  async function act(path, body) {
    try {
      render(await api.post(path, body));
      return true;
    } catch (err) {
      if (err.status !== 401) setMsg(err.message, 'bad');
      return false;
    }
  }

  async function saveZoom() {
    const zoom = $('zoom');
    if (!state || state.meeting.finalized || zoom.value.trim() === String(state.meeting.zoom)) return;
    if (await act('/api/zoom', { value: zoom.value })) {
      setMsg('Saved', 'ok');
      setTimeout(() => { if ($('zoomMsg').textContent === 'Saved') setMsg('', ''); }, 2000);
    }
  }
  $('zoom').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveZoom(); $('zoom').blur(); } });
  $('zoom').addEventListener('blur', saveZoom);

  for (const b of document.querySelectorAll('[data-type]')) b.addEventListener('click', () => act('/api/type', { type: b.dataset.type }));

  $('finalize').addEventListener('click', async () => {
    await saveZoom();
    act(state && state.meeting.finalized ? '/api/unlock' : '/api/finalize');
  });
  $('rerender').addEventListener('click', () => act('/api/rerender'));

  // Two taps to start a new meeting: dialogs don't work inside OBS docks.
  let armed = null;
  $('newMeeting').addEventListener('click', () => {
    const b = $('newMeeting');
    if (armed) {
      clearTimeout(armed); armed = null;
      b.textContent = 'New meeting'; b.classList.remove('armed');
      act('/api/new');
      return;
    }
    b.textContent = 'Tap again to clear the count';
    b.classList.add('armed');
    armed = setTimeout(() => { armed = null; b.textContent = 'New meeting'; b.classList.remove('armed'); }, 4000);
  });

  $('toggleConnect').addEventListener('click', async () => {
    const box = $('connect');
    if (!box.hidden) { box.hidden = true; return; }
    try {
      const c = await api.get('/api/connect');
      $('qr').src = c.qr;
      $('pin').textContent = c.pin;
      $('url').textContent = c.named && c.named !== c.count ? `${c.count}\nor ${c.named}` : c.count;
      box.hidden = false;
    } catch (err) {
      setMsg(err.status === 403 ? 'The QR code and PIN are shown on the AV computer only.' : err.message, 'bad');
    }
  });

  function askPin(message = '') {
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    pinStore.clear();
    $('pinErr').textContent = message;
    $('pinScreen').hidden = false;
    $('pinInput').focus();
  }
  $('pinForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const pin = $('pinInput').value.trim();
    if (!/^\d{4}$/.test(pin)) { $('pinErr').textContent = 'The PIN is 4 numbers.'; return; }
    pinStore.set(pin);
    connect();
  });

  async function connect() {
    try {
      const who = await api.get('/api/whoami');
      if (who.pinRequired && !pinStore.get()) return askPin();
      render(await api.get('/api/state'));
    } catch (err) {
      if (err.status === 401) return;
      $('offline').hidden = false;
      setTimeout(connect, 3000);
      return;
    }
    $('pinScreen').hidden = true;
    unsubscribe = api.subscribe(render, (s) => { $('offline').hidden = s === 'live'; });
  }

  connect();
})();
