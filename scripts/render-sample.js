'use strict';

// Smoke test for the video renderer: npx electron scripts/render-sample.js [outDir]
// Starts the app's server on a scratch folder, renders a sample video and prints where and how long.

const { app } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createService } = require('../src/core/service');
const { createServer } = require('../src/core/server');
const { loadSettings } = require('../src/core/settings');
const { renderAttendance } = require('../src/render/recorder');

app.whenReady().then(async () => {
  const outDir = path.resolve(process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), 'att-video-')));
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'att-data-'));
  const settings = { ...loadSettings(dataDir), port: 0 };
  const server = createServer(createService({ dataDir, getSettings: () => settings }), { settings, webDir: path.join(__dirname, '..', 'web'), mdns: false });
  const { port } = await server.listen();
  const q = new URLSearchParams({ hall: 104, zoom: 23, total: 127, type: 'weekend', date: '2026-11-01', cong: 'Riverside Congregation', theme: 'light' });
  const started = Date.now();
  try {
    const out = await renderAttendance({
      slideUrl: `http://127.0.0.1:${port}/slide?${q}`,
      outDir,
      fileBase: 'Attendance 2026-11-01 Weekend',
    });
    console.log(JSON.stringify({ ...out, seconds: (Date.now() - started) / 1000, mp4Bytes: fs.statSync(out.mp4).size }));
  } catch (err) {
    console.error('RENDER FAILED:', err.message);
    process.exitCode = 1;
  } finally {
    await server.close();
    app.quit();
  }
});
