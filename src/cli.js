'use strict';

// Headless server, for testing without Electron: npm run serve [-- --data <folder>]
// Counting, the dock and history all work; Finalize locks the numbers but makes no video.

const path = require('node:path');
const { createService } = require('./core/service');
const { createServer } = require('./core/server');
const { loadSettings, saveSettings, newPin } = require('./core/settings');
const { createGoogleSync } = require('./core/google/sync');
const googleConfig = require('./core/google/config');
const { version } = require('../package.json');

const i = process.argv.indexOf('--data');
const dataDir = path.resolve(i > 0 ? process.argv[i + 1] : 'data');
const getSettings = () => loadSettings(dataDir);

// Without the desktop app there is no folder picker and nothing to update.
const host = {
  version,
  saveSettings: (patch) => saveSettings(dataDir, patch),
  newPin: () => saveSettings(dataDir, { pin: newPin() }),
  chooseFolder: async () => null,
  openFolder: () => {},
  updateStatus: () => ({ state: 'unsupported', message: 'Updates only work in the installed app.', version: null, percent: 0 }),
  checkUpdate: async () => {},
  installUpdate: () => false,
};

const service = createService({ dataDir, getSettings });
const google = createGoogleSync({ dataDir, getSettings, getHistory: () => service.store.listHistory(), ...googleConfig });
service.setSync(google);
const server = createServer(service, { settings: getSettings, webDir: path.join(__dirname, '..', 'web'), host, google });

server.listen().then(() => {
  const u = server.urls();
  console.log(`Kingdom Hall Attendance is running (data: ${dataDir})`);
  console.log(`  Link:   ${u.count}${u.named ? `  (or ${u.named})` : ''}`);
  console.log(`  Dock:   ${u.dock}`);
  console.log(`  PIN:    ${getSettings().pin}`);
});

const stop = () => server.close().then(() => process.exit(0));
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
