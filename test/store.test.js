'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createStore } = require('../src/core/store');
const { loadSettings, saveSettings } = require('../src/core/settings');
const { newMeeting, applyTap, setZoom } = require('../src/core/meeting');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'att-'));
const sunday = new Date(2026, 10, 1);

function sample() {
  let m = newMeeting(sunday);
  m = { ...m, lanes: { left: 34, center: 41, right: 29 } };
  return setZoom(m, 23);
}

test('the current meeting survives a restart', () => {
  const dir = tmp();
  const m = applyTap(newMeeting(sunday), 'left', 1);
  createStore(dir).saveCurrent(m);
  assert.deepEqual(createStore(dir).loadCurrent(), m);
  assert.equal(fs.existsSync(path.join(dir, 'current.json.tmp')), false);
});

test('an empty folder has no current meeting', () => {
  assert.equal(createStore(tmp()).loadCurrent(), null);
});

test('a corrupt current.json is set aside, not crashed on', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'current.json'), '{oops');
  assert.equal(createStore(dir).loadCurrent(), null);
  const files = fs.readdirSync(dir);
  assert.ok(files.some((f) => /^current\.corrupt-\d+\.json$/.test(f)), files.join(','));
  assert.equal(files.includes('current.json'), false);
});

test('re-finalizing the same meeting replaces its history entry', () => {
  const store = createStore(tmp());
  store.upsertHistory(sample());
  store.upsertHistory({ ...sample(), zoom: 30 });
  const list = store.listHistory();
  assert.equal(list.length, 1);
  assert.equal(list[0].zoom, 30);
});

test('history lists newest first', () => {
  const store = createStore(tmp());
  store.upsertHistory(newMeeting(new Date(2026, 9, 29)));
  store.upsertHistory(sample());
  store.upsertHistory(newMeeting(new Date(2026, 9, 25)));
  assert.deepEqual(store.listHistory().map((m) => m.date), ['2026-11-01', '2026-10-29', '2026-10-25']);
});

test('history exports as CSV', () => {
  const store = createStore(tmp());
  store.upsertHistory(sample());
  assert.equal(store.historyCsv(), 'date,meeting,left,center,right,hall,zoom,total\n2026-11-01,weekend,34,41,29,104,23,127\n');
});

test('settings start from defaults and keep their PIN', () => {
  const dir = tmp();
  const s = loadSettings(dir);
  assert.equal(s.port, 4590);
  assert.equal(s.hostname, 'attendance');
  assert.equal(s.localNoPin, true);
  assert.equal(s.theme, 'light');
  assert.equal(s.appearance, 'auto');
  assert.equal(s.m3Folder, '');
  assert.match(s.pin, /^\d{4}$/);
  assert.equal(loadSettings(dir).pin, s.pin);
});

test('saving settings merges the change and persists it', () => {
  const dir = tmp();
  const pin = loadSettings(dir).pin;
  const s = saveSettings(dir, { congregation: 'East-Tagalog Lingayen Congregation' });
  assert.equal(s.congregation, 'East-Tagalog Lingayen Congregation');
  assert.equal(s.pin, pin);
  assert.equal(loadSettings(dir).congregation, 'East-Tagalog Lingayen Congregation');
});
