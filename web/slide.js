'use strict';

// Draws the attendance video. The numbers come from the query string:
//   /slide?hall=104&zoom=23&total=127&type=weekend&date=2026-11-01&cong=…&theme=light
//   &t=6       draw that moment (default: the final frame)
//   &play=1    play in real time
//   &live=1    follow the app and replay whenever attendance is finalized (OBS browser source fallback)
// window.renderAt(t) draws a moment and resolves after it is painted; the video renderer uses it.

(function () {
  const { DURATION, frameAt, vis, clamp } = window.AttendanceTimeline;
  const { hallArt, platformArt, remoteArt } = window.AttendanceArt;
  const q = new URLSearchParams(location.search);
  const $ = (id) => document.getElementById(id);
  const slide = $('slide');
  const els = [...document.querySelectorAll('.el')];
  const fmt = (n) => Number(n).toLocaleString('en-US');

  $('artIntro').innerHTML = hallArt({ id: 'a1' });
  $('artHall').innerHTML = platformArt({ id: 'a2' });
  $('artZoom').innerHTML = remoteArt({ id: 'a3' });

  const num = (v) => clamp(Math.round(Number(v) || 0), 0, 99999);
  let data = {};

  function setData(p) {
    const hall = num(p.hall);
    const zoom = num(p.zoom);
    const total = p.total !== undefined && p.total !== null && p.total !== '' ? num(p.total) : hall + zoom;
    const type = p.type === 'weekend' ? 'Weekend' : 'Midweek';
    const cong = (p.cong || '').trim();
    const [y, m, d] = String(p.date || '').split('-').map(Number);
    const date = y ? new Date(y, m - 1, d) : new Date();
    const dateText = date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    data = { hall, zoom, total };
    slide.dataset.theme = p.theme === 'dark' ? 'dark' : 'light';
    $('introType').textContent = `${type} Meeting`;
    $('introCong').textContent = cong;
    $('introDate').textContent = dateText;
    $('footLeft').textContent = cong ? `${cong} · ${type} Meeting` : `${type} Meeting`;
    $('footRight').textContent = dateText;
    $('chipHall').textContent = fmt(hall);
    $('chipZoom').textContent = fmt(zoom);
  }

  function draw(t) {
    const f = frameAt(t, data);
    for (const el of els) {
      const v = vis(t, el.dataset.b, parseFloat(el.dataset.d || 0));
      let tf = `translateY(${((1 - v.e) * 20 - v.x * 10).toFixed(2)}px)`;
      if (el.dataset.s) tf = `scale(${((0.97 + 0.03 * v.e) * (1 + 0.03 * v.p)).toFixed(4)})`;
      if (el.dataset.r) tf = `scale(${(0.92 + 0.08 * v.e).toFixed(4)})`;
      el.style.opacity = v.o.toFixed(4);
      el.style.transform = tf;
    }
    $('hallNum').textContent = fmt(f.hallShown);
    $('zoomNum').textContent = fmt(f.zoomShown);
    $('totalNum').textContent = fmt(f.totalShown);
  }

  const painted = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  window.renderAt = async (t) => {
    await document.fonts.ready;
    draw(t);
    await painted();
  };

  // Fit 1920×1080 into whatever window shows it (a browser, OBS); the renderer uses exactly 1920×1080.
  const fit = () => {
    const k = Math.min(innerWidth / 1920, innerHeight / 1080);
    slide.style.transform = k === 1 ? '' : `translate(${(innerWidth - 1920 * k) / 2}px, ${(innerHeight - 1080 * k) / 2}px) scale(${k})`;
  };
  addEventListener('resize', fit);
  fit();

  let playing = 0;
  function play() {
    const id = ++playing;
    const start = performance.now();
    const tick = (now) => {
      if (id !== playing) return;
      const t = (now - start) / 1000;
      draw(Math.min(t, DURATION));
      if (t < DURATION) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  setData(Object.fromEntries(q));
  draw(q.has('t') ? Number(q.get('t')) : DURATION);
  window.slideReady = document.fonts.ready.then(() => true);

  if (q.get('play') === '1') document.fonts.ready.then(play);

  if (q.get('live') === '1') {
    const { createApi, pinStore } = window.AttendanceApi;
    const api = createApi({ getPin: () => q.get('pin') || pinStore.get() });
    let wasFinal = null;
    api.subscribe((s) => {
      setData({ hall: s.totals.hall, zoom: s.totals.zoom, total: s.totals.total, type: s.meeting.type, date: s.meeting.date, cong: s.congregation, theme: q.get('theme') || s.theme });
      if (s.meeting.finalized && wasFinal === false) play();
      else if (!playing || !s.meeting.finalized) draw(DURATION);
      wasFinal = s.meeting.finalized;
    });
  }
})();
