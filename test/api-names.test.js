'use strict';

// Routes for counting by name, the list, settings and the overseer's workbook. Made-up names only.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ExcelJS = require('exceljs');
const { createService } = require('../src/core/service');
const { createServer } = require('../src/core/server');
const { loadSettings } = require('../src/core/settings');
const { MAX_LIST_BYTES, BAD_FILE } = require('../src/core/roster');

const WEB = path.join(__dirname, '..', 'web');

// phone: true makes every request look like it comes from a phone on the Wi-Fi, not the AV computer.
async function start({ phone = false } = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'att-names-api-'));
  const settings = { ...loadSettings(dataDir), port: 0, localNoPin: true };
  const saved = [];
  const host = {
    version: '0.3.0',
    saveSettings: (patch) => { saved.push(patch); Object.assign(settings, patch); return settings; },
    newPin: () => { settings.pin = '9999'; return settings; },
    chooseFolder: async () => { settings.m3Folder = 'D:\\M3 Shared'; return settings.m3Folder; },
    openFolder: () => {},
    updateStatus: () => ({ state: 'current', message: '', version: null, percent: 0 }),
    checkUpdate: async () => {},
    installUpdate: () => false,
  };
  const service = createService({ dataDir, getSettings: () => settings });
  const server = createServer(service, { settings, webDir: WEB, mdns: false, host, trustLoopback: !phone });
  const { port } = await server.listen();
  const base = `http://127.0.0.1:${port}`;
  const call = (p, body, headers = {}) => fetch(base + p, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : (Buffer.isBuffer(body) ? body : JSON.stringify(body)),
  });
  return { settings, service, server, base, call, saved, pin: { 'x-pin': settings.pin } };
}

const PEOPLE = [{ name: 'Santos, Ana', group: 'Publishers', size: 1 }, { name: 'Reyes, Mark & Joy', group: 'Publishers', size: 2 }];

test('a phone marks by name; the AV-only routes refuse it, with or without the PIN', async (t) => {
  const av = await start();
  t.after(() => av.server.close());
  assert.equal((await av.call('/api/roster', { people: PEOPLE })).status, 200);

  const s = await start({ phone: true });
  t.after(() => s.server.close());
  s.service.importRoster(PEOPLE);
  const ok = await s.call('/api/mark', { id: 'p2', where: 'kh', tapId: 'a1' }, s.pin);
  assert.equal(ok.status, 200);
  assert.deepEqual((await ok.json()).totals, { hall: 2, zoom: 0, total: 2 });
  assert.equal((await s.call('/api/unnamed', { delta: 1 }, s.pin)).status, 200);
  assert.equal((await s.call('/api/visitor', { name: 'Lim, Grace', where: 'zoom' }, s.pin)).status, 200);
  assert.equal((await s.call('/api/roster', undefined, s.pin)).status, 200);

  const avOnly = [
    ['/api/finalize', {}], ['/api/unlock', {}], ['/api/new', {}], ['/api/type', { type: 'midweek' }], ['/api/rerender', {}],
    ['/api/roster', { people: PEOPLE }], ['/api/roster/add', { name: 'X' }], ['/api/roster/remove', { id: 'p1' }],
    ['/api/roster/preview', Buffer.from('x')], ['/api/settings', { congregation: 'X' }], ['/api/pin/new', {}],
    ['/api/host/choose-folder', {}], ['/api/host/open-folder', { which: 'm3' }], ['/api/host/check-update', {}], ['/api/host/install-update', {}],
    ['/api/settings', undefined], ['/api/roster/template.csv', undefined],
  ];
  for (const [p, body] of avOnly) {
    for (const headers of [{}, s.pin]) {
      const r = await s.call(p, body, headers);
      assert.equal(r.status, 403, `${p} ${headers['x-pin'] ? 'with' : 'without'} PIN`);
      assert.deepEqual(await r.json(), { error: 'Only on the AV computer.' });
    }
  }
  assert.equal(s.service.getState().meeting.finalized, false);
});

test('bad mark and visitor input is refused with a plain reason', async (t) => {
  const s = await start();
  t.after(() => s.server.close());
  s.service.importRoster(PEOPLE);
  assert.equal((await s.call('/api/mark', { id: 'p9', where: 'kh' })).status, 400);
  assert.equal((await s.call('/api/mark', { id: 'p1', where: 'roof' })).status, 400);
  const r = await s.call('/api/visitor', { name: '  ', where: 'kh' });
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /Type a name/);
});

test('reading a list file: a real .xlsx previews its sheets; bad files are refused and the list is untouched', async (t) => {
  const s = await start();
  t.after(() => s.server.close());
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('MIDWEEK');
  [['PUBLISHER'], ['Santos, Ana'], ['CLMS'], ['Navarro, Ella']].forEach((r) => ws.addRow(r));
  const good = await s.call('/api/roster/preview', Buffer.from(await wb.xlsx.writeBuffer()), { 'content-type': 'application/octet-stream', 'x-filename': 'list.xlsx' });
  assert.equal(good.status, 200);
  const { sheets } = await good.json();
  assert.deepEqual(sheets.map((x) => [x.name, x.people.length]), [['MIDWEEK', 2]]);

  for (const [body, name] of [[Buffer.alloc(0), 'a.xlsx'], [Buffer.alloc(MAX_LIST_BYTES + 1024), 'big.xlsx'], [Buffer.from('%PDF-1.4 x'), 'a.xlsx']]) {
    const r = await s.call('/api/roster/preview', body, { 'content-type': 'application/octet-stream', 'x-filename': name });
    assert.equal(r.status, 400, name);
    assert.deepEqual(await r.json(), { error: BAD_FILE });
  }
  assert.equal(s.service.getRoster().length, 0);
  assert.equal((await s.call('/api/roster', { people: [] })).status, 400, 'an empty list is never saved');
});

test('the list can be edited from the AV computer', async (t) => {
  const s = await start();
  t.after(() => s.server.close());
  await s.call('/api/roster', { people: PEOPLE });
  assert.equal((await (await s.call('/api/roster/add', { name: 'Cruz, Lea', group: 'Publishers' })).json()).id, 'p3');
  await s.call('/api/roster/remove', { id: 'p1' });
  assert.deepEqual((await (await s.call('/api/roster')).json()).map((p) => p.id), ['p2', 'p3']);
  const tpl = await s.call('/api/roster/template.csv');
  assert.match(tpl.headers.get('content-disposition'), /publisher-list-template\.csv/);
  assert.match(await tpl.text(), /^Name,Group/);
});

test('old links still work: they lead to the one link', async (t) => {
  const s = await start();
  t.after(() => s.server.close());
  for (const [from, to] of [['/count', '/'], ['/zoom', '/'], ['/dock', '/desk'], ['/history', '/#/history']]) {
    const r = await fetch(s.base + from, { redirect: 'manual' });
    assert.equal(r.status, 302, from);
    assert.equal(r.headers.get('location'), to, from);
  }
  assert.equal((await fetch(`${s.base}/../package.json`)).status, 404);
});

test('the overseer workbook downloads after a meeting is finalized', async (t) => {
  const s = await start();
  t.after(() => s.server.close());
  await s.call('/api/roster', { people: PEOPLE });
  await s.call('/api/mark', { id: 'p1', where: 'kh' });
  await s.call('/api/finalize', {});
  const r = await s.call('/api/history.xlsx');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-disposition'), /Attendance for the circuit overseer\.xlsx/);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await r.arrayBuffer()));
  assert.equal(wb.worksheets.at(-1).name, 'SUMMARY (AVERAGE)');
});

test('settings round-trip through the app; unknown keys are ignored', async (t) => {
  const s = await start();
  t.after(() => s.server.close());
  const r = await s.call('/api/settings', { congregation: '  Riverside  ', appearance: 'dark', autoUpdate: false, port: 1, pin: '0000' });
  assert.equal(r.status, 200);
  assert.deepEqual(s.saved, [{ congregation: 'Riverside', appearance: 'dark', autoUpdate: false }]);
  const info = await (await s.call('/api/settings')).json();
  assert.equal(info.version, '0.3.0');
  assert.equal(info.settings.appearance, 'dark');
  assert.equal(info.update.state, 'current');
  assert.match(info.links.count, /\/$/);
  assert.match(info.qr, /^data:image\/png;base64,/);
  assert.equal((await (await s.call('/api/pin/new', {})).json()).settings.pin, '9999');
  assert.equal((await (await s.call('/api/host/choose-folder', {})).json()).settings.m3Folder, 'D:\\M3 Shared');
  assert.equal((await s.call('/api/settings', { appearance: 'purple' })).status, 200);
  assert.equal(s.settings.appearance, 'dark', 'a bad value is dropped');
});
