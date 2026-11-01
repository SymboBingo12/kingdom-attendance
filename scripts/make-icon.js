'use strict';

// Draws assets/icon.png (256×256): npx electron scripts/make-icon.js
// Original glyph in Steward colours: three people, like the audience artwork.

const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const person = (x, y, k) => `<g transform="translate(${x} ${y}) scale(${k})" fill="#ffffff"><path d="M-62 90 C-62 28 -36 8 0 8 C36 8 62 28 62 90 Z"/><ellipse cx="0" cy="-22" rx="25" ry="30"/></g>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <rect x="8" y="8" width="240" height="240" rx="56" fill="#4a6da7"/>
  <circle cx="128" cy="118" r="78" fill="#3a5a90"/>
  ${person(70, 150, 0.62)}${person(186, 150, 0.62)}${person(128, 140, 0.78)}
  <rect x="40" y="196" width="176" height="8" rx="4" fill="#e3eaf5" opacity=".9"/>
</svg>`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 256, height: 256, show: false, frame: false, transparent: true, webPreferences: { offscreen: true } });
  await win.loadURL(`data:text/html,<html><body style="margin:0;background:transparent">${encodeURIComponent(svg)}</body></html>`);
  await new Promise((r) => setTimeout(r, 300));
  const img = await win.webContents.capturePage();
  const out = path.join(__dirname, '..', 'assets', 'icon.png');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, img.resize({ width: 256, height: 256 }).toPNG());
  console.log('wrote', out);
  app.quit();
});
