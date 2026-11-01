'use strict';

(function () {
  const A = window.attendance;
  const $ = (id) => document.getElementById(id);
  let current = null;

  function show(info) {
    current = info;
    const s = info.settings;
    $('qr').src = info.qr;
    $('pin').textContent = info.pin;
    $('count').textContent = info.count;
    $('named').textContent = info.named || 'Not available';
    $('zoom').textContent = info.zoom;
    $('dock').textContent = info.dock;
    if (document.activeElement !== $('cong')) $('cong').value = s.congregation || '';
    $('m3').textContent = s.m3Folder || 'Not set: videos go to the Desktop';
    $('m3').classList.toggle('empty', !s.m3Folder);
    $('openM3').disabled = !s.m3Folder;
    for (const b of document.querySelectorAll('[data-theme]')) b.setAttribute('aria-pressed', String(b.dataset.theme === (s.theme || 'light')));
    for (const b of document.querySelectorAll('[data-appearance]')) b.setAttribute('aria-pressed', String(b.dataset.appearance === (s.appearance || 'light')));
    $('login').setAttribute('aria-checked', String(!!s.openAtLogin));
    $('autoUpd').setAttribute('aria-checked', String(!!s.autoUpdate));
    $('ver').textContent = `Kingdom Attendance ${info.version}`;
    showUpdate(info.update);
  }

  const UPDATE_TEXT = {
    unsupported: (u) => u.message,
    idle: () => 'Not checked yet.',
    checking: () => 'Checking for a new version…',
    current: () => 'Up to date.',
    downloading: (u) => `Downloading version ${u.version}… ${u.percent}%`,
    ready: (u) => `Version ${u.version} is ready. It installs when the app is quit, or press Restart and update.`,
    error: (u) => `Couldn't check for updates: ${u.message}`,
  };
  function showUpdate(u) {
    $('updText').textContent = (UPDATE_TEXT[u.state] || UPDATE_TEXT.idle)(u);
    $('installUpd').hidden = u.state !== 'ready';
    $('checkUpd').disabled = ['unsupported', 'checking', 'downloading', 'ready'].includes(u.state);
  }

  let savedTimer = null;
  function saved(text = 'Saved') {
    $('saved').textContent = text;
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => { $('saved').textContent = ''; }, 2000);
  }
  const save = async (patch) => { show(await A.save(patch)); saved(); };

  document.addEventListener('click', async (e) => {
    const copy = e.target.closest('[data-copy]');
    if (copy) { await A.copy(current[copy.dataset.copy] || ''); saved('Copied'); return; }
    const open = e.target.closest('[data-open]');
    if (open && current[open.dataset.open]) A.open(current[open.dataset.open]);
    const theme = e.target.closest('[data-theme]');
    if (theme) save({ theme: theme.dataset.theme });
    const appearance = e.target.closest('[data-appearance]');
    if (appearance) save({ appearance: appearance.dataset.appearance });
  });

  $('cong').addEventListener('change', () => save({ congregation: $('cong').value.trim() }));
  $('browse').addEventListener('click', async () => { show(await A.browseM3()); saved(); });
  $('openM3').addEventListener('click', () => A.openFolder('m3'));
  $('openSlides').addEventListener('click', () => A.openFolder('slides'));
  $('newPin').addEventListener('click', async () => { show(await A.newPin()); saved('New PIN made. Phones need the new PIN.'); });
  $('login').addEventListener('click', () => save({ openAtLogin: $('login').getAttribute('aria-checked') !== 'true' }));
  $('autoUpd').addEventListener('click', () => save({ autoUpdate: $('autoUpd').getAttribute('aria-checked') !== 'true' }));
  $('checkUpd').addEventListener('click', async () => show(await A.checkUpdate()));
  $('installUpd').addEventListener('click', async () => {
    if (!(await A.installUpdate())) saved('Wait until the video is finished, then try again.');
  });
  A.onUpdate(showUpdate);

  A.info().then(show);
  window.addEventListener('focus', () => A.info().then(show));
})();
