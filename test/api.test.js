'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createService } = require('../src/core/service');
const { createServer } = require('../src/core/server');
const { loadSettings } = require('../src/core/settings');

const WEB = path.join(__dirname, '..', 'web');

async function start({ localNoPin = true, now } = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'att-api-'));
  const settings = { ...loadSettings(dataDir), port: 0, localNoPin };
  const service = createService({ dataDir, now, getSettings: () => settings });
  const server = createServer(service, { settings, webDir: WEB, mdns: false });
  const { port } = await server.listen();
  const base = `http://127.0.0.1:${port}`;
  const call = (p, body, headers = {}) => fetch(base + p, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { dataDir, settings, service, server, base, call };
}

let n = 0;
const tapId = () => `t${Date.now()}-${n++}`;

test('100 taps from two phones at once all count', async (t) => {
  const s = await start();
  t.after(() => s.server.close());
  const batch = () => Promise.all(Array.from({ length: 50 }, () => s.call('/api/tap', { lane: 'left', delta: 1, tapId: tapId() })));
  await Promise.all([batch(), batch()]);
  const state = await (await s.call('/api/state')).json();
  assert.equal(state.meeting.lanes.left, 100);
  assert.equal(state.totals.hall, 100);
});

test('a retried tap with the same tapId counts once', async (t) => {
  const s = await start();
  t.after(() => s.server.close());
  const id = tapId();
  assert.equal((await s.call('/api/tap', { lane: 'center', delta: 1, tapId: id })).status, 200);
  assert.equal((await s.call('/api/tap', { lane: 'center', delta: 1, tapId: id })).status, 200);
  const state = await (await s.call('/api/state')).json();
  assert.equal(state.meeting.lanes.center, 1);
});

test('bad Zoom input is refused and leaves the number alone', async (t) => {
  const s = await start();
  t.after(() => s.server.close());
  const bad = await s.call('/api/zoom', { value: 'abc' });
  assert.equal(bad.status, 400);
  assert.match((await bad.json()).error, /whole number/);
  const ok = await s.call('/api/zoom', { value: '23' });
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).totals.zoom, 23);
});

test('taps after finalize are accepted and flag the video as out of date', async (t) => {
  const s = await start();
  t.after(() => s.server.close());
  assert.equal((await s.call('/api/finalize', {})).status, 200);
  const after = await s.call('/api/tap', { lane: 'left', delta: 1, tapId: tapId() });
  assert.equal(after.status, 200);
  const state = await after.json();
  assert.equal(state.meeting.finalized, true);
  assert.equal(state.meeting.videoStale, true);
});

test('away from the AV PC the PIN is required, and guessing is slowed down', async (t) => {
  const s = await start({ localNoPin: false });
  t.after(() => s.server.close());
  assert.equal((await s.call('/api/state')).status, 401);
  assert.equal((await s.call('/api/state', undefined, { 'x-pin': s.settings.pin })).status, 200);
  const wrong = s.settings.pin === '0000' ? '1111' : '0000';
  for (let i = 0; i < 5; i++) assert.equal((await s.call('/api/state', undefined, { 'x-pin': wrong })).status, 401);
  assert.equal((await s.call('/api/state', undefined, { 'x-pin': wrong })).status, 429);
});

test('the live stream sends the state, then every change', async (t) => {
  const s = await start();
  t.after(() => s.server.close());
  const ac = new AbortController();
  t.after(() => ac.abort());
  const res = await fetch(`${s.base}/api/events`, { signal: ac.signal });
  assert.equal(res.headers.get('content-type'), 'text/event-stream');
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  const nextEvent = async () => {
    const deadline = Date.now() + 1000;
    while (Date.now() < deadline) {
      const i = buf.indexOf('\n\n');
      if (i >= 0) {
        const chunk = buf.slice(0, i);
        buf = buf.slice(i + 2);
        const line = chunk.split('\n').find((l) => l.startsWith('data: '));
        if (line) return JSON.parse(line.slice(6));
        continue;
      }
      const { value } = await reader.read();
      buf += dec.decode(value);
    }
    throw new Error('no event within 1 s');
  };
  assert.equal((await nextEvent()).meeting.lanes.right, 0);
  await s.call('/api/tap', { lane: 'right', delta: 1, tapId: tapId() });
  assert.equal((await nextEvent()).meeting.lanes.right, 1);
});

test('the count survives restarting the app', async () => {
  const s = await start();
  await s.call('/api/tap', { lane: 'left', delta: 1, tapId: tapId() });
  await s.call('/api/tap', { lane: 'left', delta: 1, tapId: tapId() });
  await s.server.close();
  const again = createService({ dataDir: s.dataDir, getSettings: () => s.settings });
  assert.equal(again.getState().meeting.lanes.left, 2);
});

test('the first tap on a new day starts a fresh meeting', async (t) => {
  let clock = new Date(2026, 10, 1, 10);
  const s = await start({ now: () => clock });
  t.after(() => s.server.close());
  await s.call('/api/tap', { lane: 'left', delta: 1, tapId: tapId() });
  clock = new Date(2026, 10, 5, 19);
  const res = await (await s.call('/api/tap', { lane: 'right', delta: 1, tapId: tapId() })).json();
  assert.equal(res.meeting.date, '2026-11-05');
  assert.equal(res.meeting.type, 'midweek');
  assert.deepEqual(res.meeting.lanes, { left: 0, center: 0, right: 1 });
});

test('a finalized meeting stays in history', async (t) => {
  const s = await start();
  t.after(() => s.server.close());
  await s.call('/api/tap', { lane: 'left', delta: 1, tapId: tapId() });
  await s.call('/api/finalize', {});
  const list = await (await s.call('/api/history')).json();
  assert.equal(list.length, 1);
  const csv = await s.call('/api/history.csv');
  assert.match(csv.headers.get('content-disposition'), /attachment/);
  assert.match(await csv.text(), /^date,meeting,left/);
});

test('connect info (PIN and QR) is only given to the AV PC', async (t) => {
  const s = await start();
  t.after(() => s.server.close());
  const info = await (await s.call('/api/connect')).json();
  assert.equal(info.pin, s.settings.pin);
  assert.match(info.qr, /^data:image\/png;base64,/);
  assert.match(info.count, /:\d+\/$/);
});

test('the one-link page, its scripts and Steward files are served; other files are not', async (t) => {
  const s = await start();
  t.after(() => s.server.close());
  for (const p of ['/', '/desk']) {
    const page = await fetch(`${s.base}${p}`);
    assert.equal(page.status, 200, p);
    assert.match(page.headers.get('content-type'), /text\/html/);
  }
  const js = await fetch(`${s.base}/app/main.js`);
  assert.equal(js.status, 200);
  assert.match(js.headers.get('content-type'), /javascript/);
  assert.equal((await fetch(`${s.base}/slide`)).status, 200);
  assert.equal((await fetch(`${s.base}/steward/tokens.css`)).status, 200);
  assert.equal((await fetch(`${s.base}/shared/api.js`)).status, 200);
  assert.equal((await fetch(`${s.base}/steward/..%2f..%2fpackage.json`)).status, 404);
  assert.equal((await fetch(`${s.base}/package.json`)).status, 404);
});

// The app's own colours (window and pages), separate from the video's colours ("theme").
test('the appearance choice reaches every page, before the PIN and live afterwards', async (t) => {
  const s = await start({ localNoPin: false });
  t.after(() => s.server.close());
  assert.deepEqual(await (await s.call('/api/appearance')).json(), { appearance: 'light' });
  s.settings.appearance = 'dark';
  assert.deepEqual(await (await s.call('/api/appearance')).json(), { appearance: 'dark' });
  const state = await (await s.call('/api/state', undefined, { 'x-pin': s.settings.pin })).json();
  assert.equal(state.appearance, 'dark');
  assert.equal(state.theme, 'light');
  s.settings.appearance = 'purple';
  assert.deepEqual(await (await s.call('/api/appearance')).json(), { appearance: 'light' });
});

test('meeting type can be overridden and bad values are refused', async (t) => {
  const s = await start();
  t.after(() => s.server.close());
  assert.equal((await (await s.call('/api/type', { type: 'midweek' })).json()).meeting.type, 'midweek');
  assert.equal((await s.call('/api/type', { type: 'sunday' })).status, 400);
  assert.equal((await s.call('/api/tap', '{not json')).status, 400);
});
