'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createUpdates, FIRST_CHECK_MS, CHECK_EVERY_MS } = require('../src/core/updates');

function fakeUpdater() {
  const u = new EventEmitter();
  u.checks = 0;
  u.installs = [];
  u.checkForUpdates = async () => { u.checks += 1; };
  u.quitAndInstall = (...args) => u.installs.push(args);
  return u;
}

test('without an updater (not the installed app) it says why and does nothing', async () => {
  const up = createUpdates({ updater: null, reason: 'Updates only work in the installed app.' });
  assert.deepEqual(up.status(), { state: 'unsupported', message: 'Updates only work in the installed app.', version: null, percent: 0 });
  await up.check();
  assert.equal(up.install(), false);
});

test('a new version downloads in the background, then waits to be installed', () => {
  const u = fakeUpdater();
  const up = createUpdates({ updater: u });
  assert.equal(u.autoDownload, true);
  assert.equal(u.autoInstallOnAppQuit, true);
  u.emit('checking-for-update');
  assert.equal(up.status().state, 'checking');
  u.emit('update-available', { version: '0.2.0' });
  u.emit('download-progress', { percent: 41.6 });
  assert.deepEqual(up.status(), { state: 'downloading', message: '', version: '0.2.0', percent: 42 });
  u.emit('update-downloaded', { version: '0.2.0' });
  assert.equal(up.status().state, 'ready');
  assert.equal(u.installs.length, 0, 'never restarts by itself');
});

test('no new version means up to date; a failed check is reported in one line', () => {
  const u = fakeUpdater();
  const up = createUpdates({ updater: u });
  u.emit('update-not-available');
  assert.equal(up.status().state, 'current');
  u.emit('error', new Error('net::ERR_INTERNET_DISCONNECTED\n    at stack'));
  assert.deepEqual(up.status(), { state: 'error', message: 'net::ERR_INTERNET_DISCONNECTED', version: null, percent: 0 });
});

test('no releases on GitHub yet is said in plain words', () => {
  const u = fakeUpdater();
  const up = createUpdates({ updater: u });
  u.emit('error', new Error('404 \n"method: GET url: https://github.com/SymboBingo12/kingdom-attendance/releases.atom"'));
  assert.equal(up.status().message, 'no versions have been published yet.');
});

test('a downloaded update stays ready even if a later check fails', () => {
  const u = fakeUpdater();
  const up = createUpdates({ updater: u });
  u.emit('update-downloaded', { version: '0.2.0' });
  u.emit('error', new Error('offline'));
  assert.equal(up.status().state, 'ready');
});

test('Restart and update is refused while the video is being made', () => {
  const u = fakeUpdater();
  let busy = true;
  const up = createUpdates({ updater: u, isBusy: () => busy });
  assert.equal(up.install(), false, 'nothing downloaded yet');
  u.emit('update-downloaded', { version: '0.2.0' });
  assert.equal(up.install(), false, 'busy');
  busy = false;
  assert.equal(up.install(), true);
  assert.deepEqual(u.installs, [[true, true]]);
});

test('it checks soon after start and then every few hours, only when automatic updates are on', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  let on = true;
  const u = fakeUpdater();
  const up = createUpdates({ updater: u, isEnabled: () => on });
  up.start();
  t.mock.timers.tick(FIRST_CHECK_MS);
  assert.equal(u.checks, 1);
  u.emit('update-not-available');
  on = false;
  t.mock.timers.tick(CHECK_EVERY_MS);
  assert.equal(u.checks, 1, 'switched off');
  on = true;
  t.mock.timers.tick(CHECK_EVERY_MS);
  assert.equal(u.checks, 2);
  up.stop();
});

test('a check already under way is not started twice', async () => {
  const u = fakeUpdater();
  const up = createUpdates({ updater: u });
  u.emit('update-available', { version: '0.2.0' });
  await up.check();
  assert.equal(u.checks, 0);
});

test('every change is announced so the window can show it', () => {
  const u = fakeUpdater();
  const up = createUpdates({ updater: u });
  const seen = [];
  up.on('change', (s) => seen.push(s.state));
  u.emit('checking-for-update');
  u.emit('update-not-available');
  assert.deepEqual(seen, ['checking', 'current']);
});
