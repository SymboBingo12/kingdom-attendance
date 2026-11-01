'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createService } = require('../src/core/service');

function make({ renderer, deliver } = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'att-fin-'));
  const settings = { congregation: 'East-Tagalog Lingayen Congregation', theme: 'light' };
  const calls = [];
  const service = createService({
    dataDir,
    getSettings: () => settings,
    renderer: renderer || (async (args) => { calls.push(args); return { mp4: 'C:\\v\\a.mp4', png: 'C:\\v\\a.png' }; }),
    deliver: deliver || (async () => ({ savedTo: 'C:\\M3\\2026-11-01\\a.mp4', fallback: false })),
  });
  const statuses = [];
  service.on('change', (s) => { if (statuses[statuses.length - 1] !== s.render.status) statuses.push(s.render.status); });
  return { service, statuses, calls };
}

test('Finalize makes the video and reports it ready in M³', async () => {
  const { service, statuses, calls } = make();
  service.tap('left', 1);
  service.setZoom(4);
  service.finalize();
  await service.idle();
  assert.deepEqual(statuses.slice(-2), ['rendering', 'ready']);
  const s = service.getState();
  assert.equal(s.render.message, 'Ready in M³');
  assert.equal(s.render.savedTo, 'C:\\M3\\2026-11-01\\a.mp4');
  assert.equal(calls[0].totals.total, 5);
  assert.equal(calls[0].congregation, 'East-Tagalog Lingayen Congregation');
  assert.equal(calls[0].theme, 'light');
});

test('a Desktop fallback says why', async () => {
  const { service } = make({ deliver: async () => ({ savedTo: 'C:\\Desktop\\a.mp4', fallback: true, reason: 'M³ folder not set' }) });
  service.finalize();
  await service.idle();
  assert.equal(service.getState().render.message, 'Saved to Desktop (M³ folder not set)');
});

test('pressing Finalize again while the video is being made is refused', async () => {
  let release;
  const { service } = make({ renderer: () => new Promise((r) => { release = () => r({ mp4: 'a', png: 'b' }); }) });
  service.finalize();
  assert.throws(() => service.finalize(), { code: 'BUSY', message: 'Still making the video.' });
  assert.throws(() => service.unlock(), { code: 'BUSY' });
  assert.throws(() => service.rerender(), { code: 'BUSY' });
  release();
  await service.idle();
  assert.equal(service.getState().render.status, 'ready');
});

test('a failed video keeps the numbers finalized and in history', async () => {
  const { service } = make({ renderer: async () => { throw new Error('ffmpeg missing'); } });
  service.tap('center', 1);
  service.finalize();
  await service.idle();
  const s = service.getState();
  assert.equal(s.render.status, 'error');
  assert.equal(s.render.message, "Couldn't make the video: ffmpeg missing. The numbers are saved. Try Make video again.");
  assert.equal(s.meeting.finalized, true);
  assert.equal(service.store.listHistory().length, 1);
});

test('Make video again after an error reaches ready', async () => {
  let fail = true;
  const { service } = make({ renderer: async () => { if (fail) throw new Error('busy disk'); return { mp4: 'a', png: 'b' }; } });
  service.finalize();
  await service.idle();
  assert.equal(service.getState().render.status, 'error');
  fail = false;
  service.rerender();
  await service.idle();
  assert.equal(service.getState().render.status, 'ready');
});

test('unlock, fix a number, finalize again: history keeps one updated entry', async () => {
  const { service } = make();
  service.tap('left', 1);
  service.finalize();
  await service.idle();
  service.unlock();
  service.tap('left', 1);
  service.finalize();
  await service.idle();
  const list = service.store.listHistory();
  assert.equal(list.length, 1);
  assert.equal(list[0].lanes.left, 2);
});

test('without a renderer (headless) Finalize just locks the numbers', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'att-fin-'));
  const service = createService({ dataDir, getSettings: () => ({}) });
  service.finalize();
  await service.idle();
  assert.equal(service.getState().meeting.finalized, true);
  assert.equal(service.getState().render.status, 'idle');
});
