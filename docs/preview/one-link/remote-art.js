'use strict';

// Zoom artwork (four people on a screen), made for the attendance video. Uses halftone() from Steward's art.js.
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
  return `<svg class="art" viewBox="0 0 640 640" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    ${halftone(id, dark, ['0', '1'], ['0.7', '0.3'])}
    <rect width="640" height="640" fill="${mid}"/>
    <g class="art-breathe" fill="none" stroke="${light}" stroke-opacity=".4" stroke-width="3"><circle cx="320" cy="300" r="215"/><circle cx="320" cy="300" r="262"/><circle cx="320" cy="300" r="312"/></g>
    <circle cx="320" cy="300" r="175" fill="${light}" opacity=".35"/>
    <rect width="640" height="640" fill="url(#${id}-dots)" mask="url(#${id}-m)" opacity=".3"/>
    <rect x="170" y="210" width="300" height="190" rx="16" fill="${dark}"/>
    <clipPath id="${id}-scr"><rect x="186" y="226" width="268" height="158" rx="6"/></clipPath>
    <g clip-path="url(#${id}-scr)">${tiles.join('')}</g>
    <path d="M128 412 H512 L486 446 H154 Z" fill="${dark}"/>
  </svg>`;
}
