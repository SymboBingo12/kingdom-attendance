'use strict';

// Small building blocks every view uses: escaping, icons, the top bar with Home, the totals tiles, art discs.

(function (root) {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const svg = (d, w = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICONS = {
    back: svg('<path d="M15 5l-7 7 7 7"/>', 2.4),
    chev: svg('<path d="M9 5l7 7-7 7"/>', 2.2),
    down: svg('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', 2.2),
    lock: svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', 2.2),
    info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>', 2.2),
    warn: svg('<path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4M12 17.5v.01"/>', 2.2),
    mark: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.3-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M15.5 11.5l2 2 4-4.5"/>'),
    history: svg('<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="M8.5 17v-2.5M12 17v-4.5M15.5 17v-3"/>'),
    desk: svg('<rect x="3" y="4" width="18" height="12.5" rx="2"/><path d="M10.5 7.8l4 2.45-4 2.45z"/><path d="M8.5 20.5h7M12 16.5v4"/>'),
    list: svg('<rect x="5" y="4.5" width="14" height="16.5" rx="2"/><path d="M9 3h6v3H9z"/><path d="M9 11h6M9 15h4"/>'),
    settings: svg('<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>'),
  };
  const icon = (name, cls = '') => (cls ? ICONS[name].replace('<svg', `<svg class="${cls}"`) : ICONS[name]);

  // Each drawing needs unique SVG ids on the page.
  let artN = 0;
  const art = (fn, opts = {}) => fn({ ...opts, id: `a${artN++}` });
  const disc = (fn, cls = '', opts = {}) => `<span class="st-disc art-grain ${cls}">${art(fn, opts)}</span>`;

  const typeName = (t) => (t === 'weekend' ? 'Weekend meeting' : 'Midweek meeting');
  const day = (date) => new Date(`${date}T12:00:00`);
  const longDate = (date) => day(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  // The top bar: Home (or another way back), the screen's title, and an optional pill on the right.
  const bar = (title, sub = '', right = '', back = { to: 'home', label: 'Home' }) =>
    `<header class="bar"><button class="back" data-go="${back.to}">${icon('back')}${esc(back.label)}</button><h1>${esc(title)}${sub ? `<small>${esc(sub)}</small>` : ''}</h1>${right}</header>`;

  const livePill = (state, live) => {
    if (state.meeting.finalized) return '<span class="st-pill st-pill--warn"><i></i>Finalized</span>';
    return live === 'live' ? '<span class="st-pill st-pill--ok"><i></i>Live</span>' : '<span class="st-pill st-pill--warn"><i></i>Reconnecting…</span>';
  };

  const tiles = (t) => `<div class="tiles"><div class="tile kh"><div class="k">Hall</div><div class="v st-num">${t.hall}</div></div><div class="tile zm"><div class="k">Zoom</div><div class="v st-num">${t.zoom}</div></div><div class="tile"><div class="k">Total</div><div class="v st-num">${t.total}</div></div></div>`;

  const banner = (tone, iconName, title, text, role = 'status') =>
    `<div class="st-banner${tone ? ` st-banner--${tone}` : ''}" role="${role}">${icon(iconName, 'st-banner__icon')}<div class="st-banner__body"><b>${esc(title)}</b>${text ? `<p>${esc(text)}</p>` : ''}</div></div>`;

  root.AppUI = { esc, icon, art, disc, typeName, longDate, bar, livePill, tiles, banner, resetArt: () => { artN = 0; } };
})(window);
