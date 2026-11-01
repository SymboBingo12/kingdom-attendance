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
    $('ip').textContent = info.ip || 'No network found';
    $('zoom').textContent = info.zoom;
    $('dock').textContent = info.dock;
    if (document.activeElement !== $('cong')) $('cong').value = s.congregation || '';
    $('m3').textContent = s.m3Folder || 'Not set: videos go to the Desktop';
    $('m3').classList.toggle('empty', !s.m3Folder);
    $('openM3').disabled = !s.m3Folder;
    for (const b of document.querySelectorAll('[data-theme]')) b.setAttribute('aria-pressed', String(b.dataset.theme === (s.theme || 'light')));
    $('login').setAttribute('aria-checked', String(!!s.openAtLogin));
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
  });

  $('cong').addEventListener('change', () => save({ congregation: $('cong').value.trim() }));
  $('browse').addEventListener('click', async () => { show(await A.browseM3()); saved(); });
  $('openM3').addEventListener('click', () => A.openFolder('m3'));
  $('openSlides').addEventListener('click', () => A.openFolder('slides'));
  $('newPin').addEventListener('click', async () => { show(await A.newPin()); saved('New PIN made. Phones need the new PIN.'); });
  $('login').addEventListener('click', () => save({ openAtLogin: $('login').getAttribute('aria-checked') !== 'true' }));

  A.info().then(show);
  window.addEventListener('focus', () => A.info().then(show));
})();
