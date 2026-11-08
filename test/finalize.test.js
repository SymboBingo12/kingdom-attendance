'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createService } = require('../src/core/service');

function make({ renderer, deliver, extra } = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'att-fin-'));
  const settings = { congregation: 'Riverside Congregation', theme: 'light', ...extra };
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
  assert.equal(calls[0].congregation, 'Riverside Congregation');
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

test('a change after Finalize overwrites the history record and asks for a new video', async () => {
  const { service, calls } = make();
  service.tap('left', 1);
  service.finalize();
  await service.idle();
  assert.equal(service.getState().meeting.videoStale, false);

  service.tap('left', 1);
  service.setZoom(5);
  const s = service.getState();
  assert.equal(s.meeting.finalized, true);
  assert.equal(s.meeting.videoStale, true);
  const list = service.store.listHistory();
  assert.equal(list.length, 1);
  assert.deepEqual([list[0].lanes.left, list[0].zoom], [2, 5]);

  service.rerender();
  await service.idle();
  assert.equal(service.getState().meeting.videoStale, false);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].totals.total, 7);
});

test('Announce cleaners sends the picked groups to the renderer; off sends none', async () => {
  const on = make({ extra: { announceCleaners: true, cleanersHallName: 'West Hall' } });
  on.service.setCleaners(2, 3);
  on.service.finalize();
  await on.service.idle();
  assert.deepEqual(on.calls[0].cleaners, { restrooms: 'FSG 2', hall: 'FSG 3', hallName: 'West Hall' });
  assert.deepEqual(on.service.getState().cleaners, on.calls[0].cleaners);

  on.service.setCleaners(4); // only the restrooms change; the hall keeps its group. A change after Finalize asks for a new video
  assert.equal(on.service.getState().meeting.videoStale, true);
  on.service.rerender();
  await on.service.idle();
  assert.deepEqual(on.calls[1].cleaners, { restrooms: 'FSG 4', hall: 'FSG 3', hallName: 'West Hall' });

  const off = make({ extra: { announceCleaners: false } });
  off.service.setCleaners(2, 3);
  off.service.finalize();
  await off.service.idle();
  assert.equal(off.calls[0].cleaners, null);
  assert.equal(off.service.getState().cleaners, null);
});

test('a new day starts at zero and picks midweek or weekend by itself, even before anyone taps', () => {
  const os = require('node:os');
  const fs = require('node:fs');
  const path = require('node:path');
  const { createService } = require('../src/core/service');
  let day = new Date(2026, 10, 4, 20, 0); // Wednesday evening
  const s = createService({ dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'att-day-')), now: () => day, getSettings: () => ({}) });
  s.setZoom(9);
  assert.equal(s.getState().meeting.type, 'midweek');
  assert.equal(s.getState().totals.zoom, 9);
  day = new Date(2026, 10, 8, 9, 0); // Sunday morning, nobody has tapped
  const st = s.getState();
  assert.equal(st.meeting.date, '2026-11-08');
  assert.equal(st.meeting.type, 'weekend');
  assert.equal(st.totals.total, 0);
});

test('counting is one mode at a time: list, section or overall', () => {
  const os = require('node:os');
  const fs = require('node:fs');
  const path = require('node:path');
  const { createService } = require('../src/core/service');
  let mode;
  const s = createService({ dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'att-mode-')), now: () => new Date(2026, 10, 4, 20, 0), getSettings: () => ({ countMode: mode }) });
  assert.equal(s.getState().countMode, 'sections', 'no list yet: by section');
  s.importRoster([{ name: 'Santos, Ana', group: 'Publishers', size: 1 }]);
  assert.equal(s.getState().countMode, 'list', 'a list and nothing chosen: by list, as before');
  assert.equal(s.getState().mode, 'names');
  mode = 'overall';
  assert.equal(s.getState().countMode, 'overall');
  assert.equal(s.getState().mode, 'columns', 'with a list kept but another mode chosen, people are not marked by name');
  mode = 'list';
  assert.equal(s.getState().mode, 'names');
});
