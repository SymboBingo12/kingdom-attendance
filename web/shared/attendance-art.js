'use strict';

// Kingdom Hall Attendance's own artwork for the app's screens: original, drawn in code, in Steward's visual language
// (duotone, halftone dots, big circles, people seen from behind) with this app's palette: deep slate, terracotta and
// warm sand, plus Steward's teal for Zoom. Each function returns an SVG string; one layer carries .art-breathe so it
// can rest on welcome and empty screens. The video's artwork stays in art.js.

(function (root) {
  // Steward's halftone helper (kingdom-project-design/brand/art.js, same author, MIT).
  const halftone = (id, color, from, to) => `
  <defs>
    <pattern id="${id}-dots" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="4.5" cy="4.5" r="2" fill="${color}"/></pattern>
    <linearGradient id="${id}-fade" x1="${from[0]}" y1="${from[1]}" x2="${to[0]}" y2="${to[1]}"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>
    <mask id="${id}-m"><rect width="100%" height="100%" fill="url(#${id}-fade)"/></mask>
  </defs>`;

  const ATT = { dark: '#1e3a4c', mid: '#d9775a', light: '#f6e8d6', paper: '#fffaf2', zoom: '#2f7f86' };

  // A person seen from behind (shoulders and head)
  const person = (x, y, k, fill) => `<g transform="translate(${x} ${y}) scale(${k})" fill="${fill}"><path d="M-60 92 C-60 30 -35 10 0 10 C35 10 60 30 60 92 Z"/><ellipse cx="0" cy="-20" rx="24" ry="29"/></g>`;
  const tick = (cx, cy, r, color, w = 3) => `<path d="M${cx - r * 0.45} ${cy + r * 0.02} L${cx - r * 0.1} ${cy + r * 0.36} L${cx + r * 0.5} ${cy - r * 0.34}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;

  // The round backdrop every disc shares: sand, a terracotta sun, breathing rings and the halftone
  function backdrop(id, { cx = 200, cy = 205, r = 150 } = {}) {
    return `${halftone(id, ATT.dark, ['0', '0'], ['0.75', '0.95'])}
      <rect width="400" height="400" fill="${ATT.light}"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${ATT.mid}"/>
      <g class="art-breathe" fill="none" stroke="${ATT.dark}" stroke-opacity=".16" stroke-width="2"><circle cx="${cx}" cy="${cy}" r="${r + 22}"/><circle cx="${cx}" cy="${cy}" r="${r + 46}"/></g>
      <rect width="400" height="400" fill="url(#${id}-dots)" mask="url(#${id}-m)" opacity=".28"/>`;
  }

  // Mark attendance: a phone with names being ticked, KH in slate and one on Zoom in teal; the hall beneath
  function markArt({ id = 'mk' } = {}) {
    const rows = [0, 1, 2, 3].map((i) => {
      const y = 132 + i * 42, done = i < 3, zoom = i === 2;
      return `<circle cx="170" cy="${y + 10}" r="10" fill="${done ? (zoom ? ATT.zoom : ATT.dark) : 'none'}" stroke="${zoom ? ATT.zoom : ATT.dark}" stroke-width="2.5"/>
        ${done ? tick(170, y + 10, 10, ATT.paper, 2.6) : ''}
        <rect x="187" y="${y + 3}" width="40" height="6" rx="3" fill="${ATT.dark}" opacity=".6"/>
        <rect x="187" y="${y + 14}" width="24" height="5" rx="2.5" fill="${ATT.dark}" opacity=".28"/>
        <rect x="234" y="${y + 2}" width="24" height="16" rx="8" fill="${done ? (zoom ? ATT.zoom : ATT.mid) : 'none'}" stroke="${done ? 'none' : ATT.dark}" stroke-opacity=".35" stroke-width="2"/>`;
    }).join('');
    return `<svg class="art" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      ${backdrop(id)}
      ${person(92, 318, 0.95, ATT.dark)}${person(318, 330, 1.05, ATT.dark)}
      <g transform="rotate(-7 210 215)">
        <rect x="140" y="88" width="136" height="238" rx="24" fill="${ATT.dark}"/>
        <rect x="150" y="108" width="116" height="202" rx="12" fill="${ATT.paper}"/>
        <rect x="190" y="96" width="36" height="5" rx="2.5" fill="${ATT.light}" opacity=".5"/>
        ${rows}
      </g>
    </svg>`;
  }

  // History: a calendar page with weekly attendance bars rising
  function historyArt({ id = 'hs' } = {}) {
    const h = [58, 82, 70, 104];
    const bars = h.map((v, i) => `<rect x="${132 + i * 36}" y="${282 - v}" width="24" height="${v}" rx="5" fill="${i === 3 ? ATT.mid : ATT.dark}" opacity="${i === 3 ? 1 : 0.82}"/>`).join('');
    const pts = h.map((v, i) => [144 + i * 36, 282 - v - 16]);
    return `<svg class="art" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      ${backdrop(id, { cx: 205, cy: 200 })}
      <rect x="112" y="104" width="180" height="200" rx="16" fill="${ATT.paper}"/>
      <path d="M112 120 a16 16 0 0 1 16 -16 h148 a16 16 0 0 1 16 16 v22 h-180 Z" fill="${ATT.dark}"/>
      ${[0, 1, 2, 3].map((i) => `<rect x="${138 + i * 38}" y="92" width="10" height="26" rx="5" fill="${ATT.dark}" stroke="${ATT.paper}" stroke-width="3"/>`).join('')}
      <line x1="126" y1="283" x2="278" y2="283" stroke="${ATT.dark}" stroke-opacity=".3" stroke-width="2"/>
      ${bars}
      <polyline points="${pts.map((p) => p.join(' ')).join(' ')}" fill="none" stroke="${ATT.zoom}" stroke-width="3" stroke-dasharray="2 7" stroke-linecap="round"/>
      ${pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="${ATT.zoom}"/>`).join('')}
    </svg>`;
  }

  // AV desk: the hall monitor playing the attendance video, above the sound desk's sliders.
  // done: true shows a tick on the screen instead of play (the video is ready)
  function deskArt({ id = 'dk', done = false } = {}) {
    const sliders = [0, 1, 2, 3, 4].map((i) => {
      const x = 128 + i * 36, k = [10, 4, 14, 7, 11][i];
      return `<rect x="${x - 2}" y="300" width="4" height="30" rx="2" fill="${ATT.light}" opacity=".45"/><rect x="${x - 9}" y="${304 + k}" width="18" height="9" rx="3" fill="${i === 2 ? ATT.mid : ATT.light}"/>`;
    }).join('');
    return `<svg class="art" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      ${backdrop(id, { cx: 200, cy: 190 })}
      <rect x="88" y="78" width="224" height="146" rx="14" fill="${ATT.dark}"/>
      <rect x="100" y="90" width="200" height="122" rx="7" fill="${ATT.paper}"/>
      <circle cx="200" cy="151" r="38" fill="${done ? ATT.zoom : ATT.mid}"/>
      ${done ? tick(200, 151, 38, ATT.paper, 7) : `<path d="M188 131 L218 151 L188 171 Z" fill="${ATT.paper}"/>`}
      <rect x="114" y="196" width="${done ? 172 : 96}" height="5" rx="2.5" fill="${ATT.dark}" opacity=".35"/>
      <rect x="190" y="224" width="20" height="40" fill="${ATT.dark}"/>
      <rect x="150" y="262" width="100" height="10" rx="5" fill="${ATT.dark}"/>
      <rect x="96" y="290" width="208" height="52" rx="10" fill="${ATT.dark}"/>
      ${sliders}
    </svg>`;
  }

  // Publisher list: a clipboard of names with ticks and a pencil
  function listArt({ id = 'ls' } = {}) {
    const rows = [0, 1, 2, 3, 4].map((i) => {
      const y = 140 + i * 30, done = i < 3;
      return `<circle cx="160" cy="${y}" r="8" fill="${done ? ATT.dark : 'none'}" stroke="${ATT.dark}" stroke-width="2.4"/>${done ? tick(160, y, 8, ATT.paper, 2.4) : ''}
        <rect x="176" y="${y - 4}" width="${[66, 52, 74, 58, 46][i]}" height="7" rx="3.5" fill="${ATT.dark}" opacity="${done ? 0.55 : 0.3}"/>`;
    }).join('');
    return `<svg class="art" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      ${backdrop(id, { cx: 195, cy: 205 })}
      <rect x="122" y="92" width="152" height="222" rx="16" fill="${ATT.dark}"/>
      <rect x="134" y="112" width="128" height="190" rx="8" fill="${ATT.paper}"/>
      <rect x="166" y="80" width="64" height="26" rx="9" fill="${ATT.mid}" stroke="${ATT.dark}" stroke-width="4"/>
      ${rows}
      <g transform="rotate(38 300 250)">
        <rect x="282" y="160" width="20" height="120" rx="4" fill="${ATT.paper}" stroke="${ATT.dark}" stroke-width="4"/>
        <rect x="282" y="160" width="20" height="18" rx="4" fill="${ATT.dark}"/>
        <path d="M282 280 L302 280 L292 304 Z" fill="${ATT.light}" stroke="${ATT.dark}" stroke-width="4" stroke-linejoin="round"/><path d="M288 294 L296 294 L292 304 Z" fill="${ATT.dark}"/>
      </g>
    </svg>`;
  }

  // Home header: rows of the congregation seen from behind under a warm sun, a few already ticked off,
  // and a phone held up marking them. Drawn for a phone-width banner; wider screens show more sand at the sides.
  function attendanceHeroArt({ id = 'ah' } = {}) {
    const w = 800, h = 400, cx = 330, cy = 150;
    const rows = [
      { n: 7, x0: 40, gap: 120, y: 168, k: 0.56, op: 0.7 },
      { n: 6, x0: 85, gap: 135, y: 215, k: 0.74, op: 1 },
    ];
    let people = '', badges = '';
    rows.forEach((r, ri) => {
      for (let i = 0; i < r.n; i++) {
        const x = r.x0 + i * r.gap + (i % 2 ? 8 : -5), y = r.y + ((i * 5) % 3) * 4;
        people += `<g opacity="${r.op}">${person(x, y, r.k, ATT.dark)}</g>`;
        if (ri === 1 && [0, 1, 3].includes(i)) {
          const by = y - 60 * r.k - 22;
          badges += `<circle cx="${x}" cy="${by}" r="15" fill="${ATT.paper}" stroke="${ATT.dark}" stroke-width="2.5"/>${tick(x, by, 15, ATT.dark, 3.2)}`;
        }
      }
    });
    return `<svg class="art" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      ${halftone(id, ATT.dark, ['0', '0'], ['0.55', '0.8'])}
      <rect width="${w}" height="${h}" fill="${ATT.light}"/>
      <g class="art-breathe" fill="none" stroke="${ATT.dark}" stroke-opacity=".14" stroke-width="2.5"><circle cx="${cx}" cy="${cy}" r="200"/><circle cx="${cx}" cy="${cy}" r="245"/><circle cx="${cx}" cy="${cy}" r="300"/></g>
      <circle cx="${cx}" cy="${cy}" r="140" fill="${ATT.mid}"/>
      <rect width="${w}" height="${h}" fill="url(#${id}-dots)" mask="url(#${id}-m)" opacity=".3"/>
      <rect x="0" y="212" width="${w}" height="${h - 212}" fill="${ATT.mid}" opacity=".35"/>
      ${people}
      ${badges}
      <g transform="rotate(9 600 150)">
        <rect x="548" y="62" width="104" height="180" rx="18" fill="${ATT.dark}"/>
        <rect x="556" y="76" width="88" height="152" rx="9" fill="${ATT.paper}"/>
        ${[0, 1, 2, 3].map((i) => { const y = 96 + i * 33, zoom = i === 1, done = i < 3;
          return `<circle cx="572" cy="${y}" r="8" fill="${done ? (zoom ? ATT.zoom : ATT.dark) : 'none'}" stroke="${zoom ? ATT.zoom : ATT.dark}" stroke-width="2.2"/>${done ? tick(572, y, 8, ATT.paper, 2.2) : ''}
            <rect x="586" y="${y - 6}" width="34" height="6" rx="3" fill="${ATT.dark}" opacity=".55"/><rect x="586" y="${y + 3}" width="20" height="5" rx="2.5" fill="${ATT.dark}" opacity=".25"/>
            <rect x="626" y="${y - 7}" width="14" height="13" rx="6.5" fill="${done ? (zoom ? ATT.zoom : ATT.mid) : 'none'}" stroke="${done ? 'none' : ATT.dark}" stroke-opacity=".3" stroke-width="1.5"/>`; }).join('')}
      </g>
    </svg>`;
  }

  root.AttendanceUiArt = { attendanceHeroArt, markArt, historyArt, deskArt, listArt };
})(typeof window !== 'undefined' ? window : globalThis);
