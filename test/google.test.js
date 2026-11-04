'use strict';

// Google Sheets sync against a fake Google (no network). Made-up names only.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createService } = require('../src/core/service');
const { createGoogleSync } = require('../src/core/google/sync');
const L = require('../src/core/google/layout');

// A tiny Google: sign-in token, Drive search, and spreadsheets with tabs of rows.
function fakeGoogle() {
  const books = new Map();
  let n = 0;
  const g = { books, offline: false, calls: 0, tokenRequests: [] };
  const reply = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
  const tabOf = (id, title) => [...books.get(id).tabs.values()].find((t) => t.title === title);
  g.fetch = async (url, init = {}) => {
    if (g.offline) throw new Error('offline');
    g.calls++;
    const u = new URL(url);
    const body = init.body && typeof init.body === 'string' && init.body.startsWith('{') ? JSON.parse(init.body) : init.body;
    if (u.host === 'oauth2.googleapis.com' && u.pathname === '/token') {
      g.tokenRequests.push(Object.fromEntries(new URLSearchParams(body)));
      const id = `h.${Buffer.from(JSON.stringify({ email: 'av@example.org' })).toString('base64url')}.s`;
      return reply({ access_token: 'at', refresh_token: 'rt', expires_in: 3600, id_token: id });
    }
    if (u.host === 'oauth2.googleapis.com') return reply({});
    if (u.pathname === '/drive/v3/files') {
      const name = /name = '(.*?)' and/.exec(u.searchParams.get('q'))[1];
      return reply({ files: [...books.entries()].filter(([, b]) => b.title === name).map(([id, b]) => ({ id, name: b.title })) });
    }
    const m = /^\/v4\/spreadsheets(?:\/([^/:]+))?(.*)$/.exec(u.pathname);
    const [, id, rest] = m;
    if (!id && init.method === 'POST') {
      const sid = `sheet${++n}`;
      const tabs = new Map();
      body.sheets.forEach((s, i) => tabs.set(i + 1, { sheetId: i + 1, title: s.properties.title, rows: [] }));
      books.set(sid, { title: body.properties.title, tabs });
      return reply({ spreadsheetId: sid });
    }
    const book = books.get(id);
    if (rest === '' && init.method === 'GET') return reply({ sheets: [...book.tabs.values()].map((t) => ({ properties: { sheetId: t.sheetId, title: t.title } })) });
    if (rest === ':batchUpdate') {
      const r = body.requests[0];
      book.formatted = (book.formatted || 0) + (body.requests.length > 1 ? 1 : 0);
      if (r.addSheet) { const sheetId = book.tabs.size + 100 + Math.floor(Math.random() * 1e6); book.tabs.set(sheetId, { sheetId, title: r.addSheet.properties.title, rows: [] }); return reply({ replies: [{ addSheet: { properties: { sheetId } } }] }); }
      if (r.updateSheetProperties) { if (r.updateSheetProperties.properties.title) book.tabs.get(r.updateSheetProperties.properties.sheetId).title = r.updateSheetProperties.properties.title; return reply({}); }
      return reply({}); // styling requests
    }
    const range = decodeURIComponent(rest.replace('/values/', ''));
    const title = /^'((?:[^']|'')*)'/.exec(range)[1].replace(/''/g, "'");
    if (range.endsWith(':clear')) { tabOf(id, title).rows = []; return reply({}); }
    if (init.method === 'PUT') { tabOf(id, title).rows = body.values; return reply({}); }
    const row = tabOf(id, title).rows[0];
    return reply({ values: row ? [[row[0]]] : [] });
  };
  g.rows = (id, title) => tabOf(id, title).rows;
  g.find = (name) => [...books.entries()].find(([, b]) => b.title === name);
  return g;
}

const sunday = () => new Date(2026, 10, 1, 19, 0);
const wait = async (cond) => { for (let i = 0; i < 200 && !cond(); i++) await new Promise((r) => setTimeout(r, 10)); assert.ok(cond(), 'timed out'); };

function make(google, dir = fs.mkdtempSync(path.join(os.tmpdir(), 'att-g-'))) {
  const settings = { congregation: 'Riverside', pin: '1234' };
  const service = createService({ dataDir: dir, now: sunday, getSettings: () => settings });
  const sync = createGoogleSync({ dataDir: dir, getSettings: () => settings, getHistory: () => service.store.listHistory(), fetch: google.fetch, clientId: 'test-id', clientSecret: 'test-secret', retryMs: 0 });
  service.setSync(sync);
  return { dir, service, sync, settings };
}

// What the browser does after Google's page: go back to this computer's address with the code.
async function signIn(sync) {
  const { url } = await sync.connect();
  const q = new URL(url).searchParams;
  await fetch(`${q.get('redirect_uri')}/?code=abc&state=${q.get('state')}`);
}

const PEOPLE = [
  { name: 'Santos, Ana', group: 'Publishers', size: 1 },
  { name: 'Navarro, Ella', group: 'Unbaptized publishers', size: 1 },
  { name: '=cmd|evil', group: 'Publishers', size: 1 },
];

test('connecting creates the two spreadsheets and fills them from History', async () => {
  const g = fakeGoogle();
  const { service, sync } = make(g);
  service.importRoster(PEOPLE);
  service.mark('p1', 'kh');
  service.mark('p2', 'zoom');
  service.addVisitor('Lim', 'kh');
  service.finalize();
  await signIn(sync);
  await wait(() => sync.status().connected && sync.status().files && !sync.status().pending && !sync.status().syncing);

  assert.equal(sync.status().email, 'av@example.org');
  assert.equal(g.tokenRequests[0].code_verifier.length > 20, true, 'PKCE verifier was sent');
  const [attId] = g.find('Attendance | Riverside');
  const [logId] = g.find('Log for Attendance | Riverside');
  assert.ok(attId && logId);
  const tab = g.rows(attId, 'Weekend Meeting');
  // like the congregation's sample: an empty column A, the content from column B
  assert.deepEqual(tab.slice(0, 4), [[], ['', 'PUBLIC TALK AND WATCHTOWER STUDY'], ['', '2026-11-01'], ['', 'PUBLISHER', 'ZOOM', 'KINGDOM HALL']]);
  assert.deepEqual(tab[4], ['', 'Santos, Ana', '', 1]);
  assert.ok(tab.some((r) => r[1] === 'UNBAPTIZED PUBLISHERS'));
  assert.ok(tab.some((r) => r[1] === 'Lim' || r[1] === 'KINGDOM HALL VISITORS'));
  const sub = tab.findIndex((r) => r[1] === 'SUB-TOTAL') + 1;
  assert.deepEqual(tab.slice(-2), [['', 'SUB-TOTAL', `=SUM(C5:C${sub - 1})`, `=SUM(D5:D${sub - 1})`], ['', 'GRAND TOTAL', `=SUM(C${sub}:D${sub})`]]);
  assert.ok(tab.some((r) => r[1] === "'=cmd|evil"), 'a name that looks like a formula is kept as text');
  assert.ok(g.books.get(attId).formatted > 0, 'the tab was styled');
  const rec = g.rows(attId, 'Service Year Record (2026–2027)');
  assert.deepEqual(rec[1], ['', 'SERVICE YEAR 2026–2027 · ATTENDANCE RECORD']);
  const sun = rec.filter((r) => r[1] === '2026-11-01')[1]; // the first match is the month's heading
  assert.deepEqual([sun[5], sun[6]], [1, 2], 'the Sunday row holds the weekend Zoom and In-Person numbers');
  assert.ok(rec.some((r) => r[1] === '2026-11-03'), 'every Tuesday is pre-listed');
  const log = g.rows(logId, 'Weekend Meeting');
  assert.equal(log[0][0], 'LOG FOR ATTENDANCE – WEEKEND MEETING – SERVICE YEAR 2026–2027');
  assert.deepEqual(log[2].slice(0, 2), ['Santos, Ana', 'Publisher']);
  assert.equal(log[2][3], 1);
});

test('a change after Finalize overwrites the Google record', async () => {
  const g = fakeGoogle();
  const { service, sync } = make(g);
  service.importRoster(PEOPLE);
  await signIn(sync);
  await wait(() => sync.status().files);
  service.mark('p1', 'kh');
  service.finalize();
  await sync.idle();
  const [attId] = g.find('Attendance | Riverside');
  const khOf = () => g.rows(attId, 'Weekend Meeting').find((r) => r[1] === 'Navarro, Ella');
  assert.deepEqual(khOf(), ['', 'Navarro, Ella', '', '']);
  service.mark('p2', 'zoom');
  await sync.idle();
  assert.deepEqual(khOf(), ['', 'Navarro, Ella', 1, '']);
  assert.equal(service.store.listHistory().length, 1);
});

test('a new computer finds the existing sheets and asks before using them', async () => {
  const g = fakeGoogle();
  const first = make(g);
  first.service.importRoster(PEOPLE);
  first.service.finalize();
  await signIn(first.sync);
  await wait(() => first.sync.status().files && !first.sync.status().pending);
  assert.equal(g.books.size, 2);

  const second = make(g); // fresh data folder: the saved ids are gone
  await signIn(second.sync);
  await wait(() => second.sync.status().choice);
  assert.equal(g.books.size, 2, 'nothing was created yet');
  assert.equal(second.sync.status().choice.attendance[0].name, 'Attendance | Riverside');
  await second.sync.choose(true);
  assert.equal(g.books.size, 2, 'the existing pair was reused');
  assert.equal(second.sync.status().files.attendance.id, first.sync.status().files.attendance.id);

  const third = make(g);
  await signIn(third.sync);
  await wait(() => third.sync.status().choice);
  await third.sync.choose(false);
  assert.equal(g.books.size, 4, 'saying no makes a new pair');
});

test('offline: the meeting waits in the queue and goes up when Google is reachable', async () => {
  const g = fakeGoogle();
  const { service, sync } = make(g);
  await signIn(sync);
  await wait(() => sync.status().files);
  g.offline = true;
  service.finalize();
  await sync.idle();
  assert.equal(sync.status().pending, 1);
  assert.match(sync.status().error, /No internet/);
  g.offline = false;
  sync.flush();
  await sync.idle();
  assert.equal(sync.status().pending, 0);
  assert.equal(sync.status().error, null);
});

test('without a Google Cloud client the Connect button explains instead of failing', async () => {
  const g = fakeGoogle();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'att-g-'));
  const sync = createGoogleSync({ dataDir: dir, getSettings: () => ({ congregation: 'Riverside' }), getHistory: () => [], fetch: g.fetch, clientId: 'YOUR_CLIENT_ID.apps.googleusercontent.com', clientSecret: 'x' });
  await assert.rejects(sync.connect(), { code: 'GOOGLE_NOT_SET_UP' });
  const named = createGoogleSync({ dataDir: dir, getSettings: () => ({ congregation: '' }), getHistory: () => [], fetch: g.fetch, clientId: 'real', clientSecret: 'x' });
  await assert.rejects(named.connect(), { code: 'GOOGLE_NO_NAME' });
});

test('phones only learn the sync headline, never the account or links', async () => {
  const g = fakeGoogle();
  const { service, sync } = make(g);
  await signIn(sync);
  await wait(() => sync.status().files);
  assert.deepEqual(Object.keys(service.getState().google).sort(), ['connected', 'error', 'pending', 'syncing']);
});

test('a new service year starts fresh Log tabs and keeps the old ones', async () => {
  const g = fakeGoogle();
  const { service, sync, dir } = make(g);
  await signIn(sync);
  await wait(() => sync.status().files);
  const old = { date: '2026-08-30', type: 'weekend', lanes: { left: 0, center: 0, right: 0 }, zoom: 0, unnamed: 0, marks: { p1: { where: 'kh', n: 1 } }, people: [{ id: 'p1', name: 'Santos, Ana', group: 'Publishers', size: 1 }], finalized: true };
  service.store.upsertHistory(old);
  sync.enqueue('2026-08-30', 'weekend');
  await sync.idle();
  const [logId] = g.find('Log for Attendance | Riverside');
  assert.match(g.rows(logId, 'Weekend Meeting')[0][0], /SERVICE YEAR 2025–2026/);
  service.store.upsertHistory({ ...old, date: '2026-09-06' });
  sync.enqueue('2026-09-06', 'weekend');
  await sync.idle();
  assert.match(g.rows(logId, 'Weekend Meeting')[0][0], /SERVICE YEAR 2026–2027/);
  assert.match(g.rows(logId, 'Weekend Meeting 2025–2026')[0][0], /SERVICE YEAR 2025–2026/);
  assert.ok(fs.existsSync(path.join(dir, 'google.json')));
});

test('service years run September to August', () => {
  assert.equal(L.serviceYearOf('2026-09-01'), 2026);
  assert.equal(L.serviceYearOf('2026-08-31'), 2025);
  assert.equal(L.serviceYearOf('2027-01-10'), 2026);
  assert.equal(L.yearLabel(2026), '2026–2027');
  assert.equal(L.colLetter(4), 'D');
  assert.equal(L.colLetter(28), 'AB');
});
