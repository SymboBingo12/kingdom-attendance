'use strict';

// Headless server, for testing without Electron: npm run serve [-- --data <folder>]
// Counting, the dock and history all work; Finalize locks the numbers but makes no video.

const path = require('node:path');
const { createService } = require('./core/service');
const { createServer } = require('./core/server');
const { loadSettings } = require('./core/settings');

const i = process.argv.indexOf('--data');
const dataDir = path.resolve(i > 0 ? process.argv[i + 1] : 'data');
const getSettings = () => loadSettings(dataDir);

const service = createService({ dataDir, getSettings });
const server = createServer(service, { settings: getSettings, webDir: path.join(__dirname, '..', 'web') });

server.listen().then(() => {
  const u = server.urls();
  console.log(`Kingdom Attendance is running (data: ${dataDir})`);
  console.log(`  Count:  ${u.count}${u.named ? `  (or ${u.named})` : ''}`);
  console.log(`  Zoom:   ${u.zoom}`);
  console.log(`  Dock:   ${u.dock}`);
  console.log(`  PIN:    ${getSettings().pin}`);
});

const stop = () => server.close().then(() => process.exit(0));
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
