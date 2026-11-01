'use strict';

// Phone counting page. Numbers on screen always come from the server, never from local guesses,
// so every phone shows the same count.

(function () {
  const { createApi, newTapId, pinStore } = window.AttendanceApi;
  const $ = (id) => document.getElementById(id);
  const lanesEl = $('lanes');
  let live = false;
  let finalized = false;
  let unsubscribe = null;

  const api = createApi({ getPin: pinStore.get, onPinNeeded: () => askPin('That PIN didn\'t work. Check the AV computer.') });

  function note(text, kind = '') {
    const el = $('note');
    el.textContent = text;
    el.className = `note ${kind}`;
  }

  function setLive(status) {
    live = status === 'live';
    $('pill').dataset.s = status;
    $('pill').textContent = live ? 'Live' : 'Reconnecting…';
    updateEnabled();
    if (!live) note('Reconnecting to the AV computer… Taps are paused so nothing is lost.', 'warn');
    else if (!finalized) note('Tap + for each person you see in a column.');
  }

  function updateEnabled() {
    lanesEl.setAttribute('aria-disabled', String(!live || finalized));
  }

  const dateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });

  function render(state) {
    const m = state.meeting;
    $('hall').textContent = state.totals.hall;
    for (const lane of document.querySelectorAll('.lane')) {
      lane.querySelector('[data-n]').textContent = m.lanes[lane.dataset.lane];
    }
    const [y, mo, d] = m.date.split('-').map(Number);
    $('meta').textContent = `${m.type === 'weekend' ? 'Weekend' : 'Midweek'} meeting · ${dateFmt.format(new Date(y, mo - 1, d))}`;
    finalized = m.finalized;
    updateEnabled();
    if (finalized) note('Finalized. Ask the AV desk to unlock if a number needs changing.', 'warn');
    else if (live) note('Tap + for each person you see in a column.');
  }

  lanesEl.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn || !live || finalized) return;
    const lane = btn.closest('.lane').dataset.lane;
    const delta = Number(btn.dataset.d);
    if (delta > 0) {
      btn.classList.add('hit');
      setTimeout(() => btn.classList.remove('hit'), 120);
    }
    try {
      const state = await api.post('/api/tap', { lane, delta, tapId: newTapId() });
      if (!live) render(state);
    } catch (err) {
      if (err.status !== 401) note(`That tap didn't count: ${err.message}`, 'bad');
    }
  });

  function askPin(message = '') {
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    pinStore.clear();
    $('pinErr').textContent = message;
    $('pinScreen').hidden = false;
    $('pinInput').value = '';
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
      if (err.status === 401) return; // onPinNeeded already showed the PIN screen
      setLive('reconnecting');
      setTimeout(connect, 3000);
      return;
    }
    $('pinScreen').hidden = true;
    unsubscribe = api.subscribe(render, setLive);
  }

  connect();
})();
