'use strict';

// The app's colours (Light by default, Dark or Auto), chosen on the AV computer. Loaded in <head> so the
// page draws in the right colours; the last choice is remembered on this device for that.

(function () {
  const KEY = 'attendance-appearance';

  function apply(appearance) {
    const root = document.documentElement;
    if (appearance === 'light' || appearance === 'dark') root.dataset.theme = appearance;
    else delete root.dataset.theme; // auto: follow the phone or computer
    try { localStorage.setItem(KEY, appearance || 'light'); } catch { /* not remembered */ }
  }

  let last = 'light';
  try { last = localStorage.getItem(KEY) || 'light'; } catch { /* storage blocked */ }
  apply(last);
  fetch('/api/appearance').then((r) => r.json()).then((d) => apply(d.appearance)).catch(() => { /* keep the last choice */ });

  window.AttendanceAppearance = { apply };
})();
