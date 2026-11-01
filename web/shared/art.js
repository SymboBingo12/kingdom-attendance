'use strict';

// Artwork for the attendance video. hallArt and platformArt are from Steward's brand/art.js
// (kingdom-project-design, Caio, MIT); remoteArt is new for this app, drawn in the same style.
// Each function returns an SVG string. Original art only.

(function (root) {
  const halftone = (id, color, from, to) => `
  <defs>
    <pattern id="${id}-dots" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="4.5" cy="4.5" r="2" fill="${color}"/></pattern>
    <linearGradient id="${id}-fade" x1="${from[0]}" y1="${from[1]}" x2="${to[0]}" y2="${to[1]}"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>
    <mask id="${id}-m"><rect width="100%" height="100%" fill="url(#${id}-fade)"/></mask>
  </defs>`;

  // Seen from behind: rows of people facing the platform
  function audience(rows, dark) {
    let s = '';
    for (const r of rows) {
      for (let i = 0; i < r.n; i++) {
        const x = r.x0 + i * r.gap + (i % 2 ? r.jitter : 0), y = r.y + ((i * 7) % 3) * 6, k = r.k * (1 + (((i * 5) % 4) - 1.5) * 0.05);
        s += `<g transform="translate(${x} ${y}) scale(${k})" fill="${dark}"><path d="M-62 90 C-62 28 -36 8 0 8 C36 8 62 28 62 90 Z"/><ellipse cx="0" cy="-22" rx="25" ry="30"/></g>`;
      }
    }
    return s;
  }

  function platformArt({ dark = '#22305a', mid = '#d9a93a', light = '#f5e6b8', w = 1200, h = 620, cx = 600, id = 'pl' } = {}) {
    const cy = 250;
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    ${halftone(id, dark, ['0', '0'], ['0.6', '0.8'])}
    <rect width="${w}" height="${h}" fill="${mid}"/>
    <g fill="none" stroke="${light}" stroke-opacity=".45" stroke-width="2"><circle cx="${cx}" cy="${cy}" r="300"/><circle cx="${cx}" cy="${cy}" r="360"/><circle cx="${cx}" cy="${cy}" r="430"/></g>
    <circle cx="${cx}" cy="${cy}" r="235" fill="${light}"/>
    <g stroke="${dark}" stroke-opacity=".18" stroke-width="3">${Array.from({ length: 9 }, (_, i) => `<line x1="${cx - 200 + i * 50}" y1="0" x2="${cx - 200 + i * 50 + (i - 4) * 45}" y2="404"/>`).join('')}</g>
    <rect width="${w}" height="${h}" fill="url(#${id}-dots)" mask="url(#${id}-m)" opacity=".35"/>
    <rect x="0" y="408" width="${w}" height="${h - 408}" fill="${light}" opacity=".55"/>
    <rect x="0" y="404" width="${w}" height="6" fill="${dark}" opacity=".85"/>
    <g fill="${dark}">
      <path d="M${cx - 70} 300 L${cx + 70} 300 L${cx + 58} 322 L${cx + 48} 410 L${cx - 48} 410 L${cx - 58} 322 Z"/>
      <rect x="${cx - 78}" y="292" width="156" height="12" rx="3"/>
      <path d="M${cx + 30} 294 C${cx + 34} 262 ${cx + 22} 236 ${cx + 2} 226" fill="none" stroke="${dark}" stroke-width="5" stroke-linecap="round"/>
      <rect x="${cx - 14}" y="212" width="22" height="34" rx="11" transform="rotate(-38 ${cx - 3} 229)"/>
    </g>
    ${audience([{ n: 9, x0: 40, gap: 140, y: 520, k: 0.95, jitter: 8 }, { n: 8, x0: 100, gap: 160, y: 600, k: 1.25, jitter: -10 }], dark)}
  </svg>`;
  }

  // The Kingdom Hall building with a tree
  function hallArt({ dark = '#2d3e50', mid = '#6fa3c7', light = '#dcecf5', id = 'hl' } = {}) {
    const windows = [0, 1, 2, 3].map((i) => `<rect x="${118 + i * 46}" y="214" width="26" height="40" rx="3" fill="${light}"/>`).join('');
    return `<svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    ${halftone(id, dark, ['1', '0'], ['0.4', '0.6'])}
    <rect width="400" height="400" fill="${light}"/>
    <circle cx="200" cy="170" r="150" fill="${mid}" opacity=".55"/>
    <g fill="none" stroke="${dark}" stroke-opacity=".18" stroke-width="2"><circle cx="200" cy="170" r="172"/></g>
    <rect width="400" height="400" fill="url(#${id}-dots)" mask="url(#${id}-m)" opacity=".3"/>
    <path d="M86 180 L200 120 L314 180 Z" fill="${dark}"/>
    <rect x="96" y="178" width="208" height="122" fill="${dark}"/>
    ${windows}
    <rect x="186" y="262" width="28" height="38" fill="${mid}"/>
    <g fill="${dark}" opacity=".9"><circle cx="58" cy="226" r="34"/><circle cx="40" cy="250" r="24"/><rect x="54" y="246" width="8" height="54"/></g>
    <rect x="0" y="298" width="400" height="102" fill="${mid}"/>
    <rect x="0" y="298" width="400" height="5" fill="${dark}" opacity=".6"/>
  </svg>`;
  }

  // People joining by video: a screen of four tiles. Steward's time-and-schedules duotone.
  function remoteArt({ dark = '#164e57', mid = '#2f7f86', light = '#a9d6d9', id = 'rm' } = {}) {
    const tiles = [];
    const sx = 186, sy = 226, tw = 132, th = 77, g = 4;
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        const x = sx + c * (tw + g), y = sy + r * (th + g), cx = x + tw / 2, k = 0.42 + ((r + c) % 2) * 0.05;
        tiles.push(`<rect x="${x}" y="${y}" width="${tw}" height="${th}" rx="5" fill="${(r + c) % 2 ? light : '#c4e4e6'}"/>
      <g transform="translate(${cx} ${y + th - 36 * k * 1.2}) scale(${k})" fill="${dark}"><path d="M-62 90 C-62 28 -36 8 0 8 C36 8 62 28 62 90 Z"/><ellipse cx="0" cy="-22" rx="25" ry="30"/></g>`);
      }
    }
    return `<svg viewBox="0 0 640 640" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    ${halftone(id, dark, ['0', '1'], ['0.7', '0.3'])}
    <rect width="640" height="640" fill="${mid}"/>
    <g fill="none" stroke="${light}" stroke-opacity=".4" stroke-width="3"><circle cx="320" cy="300" r="215"/><circle cx="320" cy="300" r="262"/><circle cx="320" cy="300" r="312"/></g>
    <circle cx="320" cy="300" r="175" fill="${light}" opacity=".35"/>
    <rect width="640" height="640" fill="url(#${id}-dots)" mask="url(#${id}-m)" opacity=".3"/>
    <rect x="170" y="210" width="300" height="190" rx="16" fill="${dark}"/>
    <clipPath id="${id}-scr"><rect x="186" y="226" width="268" height="158" rx="6"/></clipPath>
    <g clip-path="url(#${id}-scr)">${tiles.join('')}</g>
    <path d="M128 412 H512 L486 446 H154 Z" fill="${dark}"/>
  </svg>`;
  }

  const api = { hallArt, platformArt, remoteArt };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AttendanceArt = api;
})(typeof window !== 'undefined' ? window : globalThis);
