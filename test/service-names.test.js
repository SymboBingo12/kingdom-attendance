'use strict';

// Counting by name in the service. Made-up names only.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createService } = require('../src/core/service');
const { loadSettings } = require('../src/core/settings');

const sunday = () => new Date(2026, 10, 1, 19, 0);
const PEOPLE = [
  { name: 'Santos, Ana', group: 'Publishers', size: 1 },
  { name: 'Reyes, Mark & Joy', group: 'Publishers', size: 2 },
  { name: 'Lim, Grace', group: 'VISITORS', size: 1 },
];

function make(dir = fs.mkdtempSync(path.join(os.tmpdir(), 'att-names-'))) {
  const settings = loadSettings(dir);
  return { dir, service: createService({ dataDir: dir, now: sunday, getSettings: () => settings }) };
}

test('importing a list gives ids, saves it, and switches to counting by name', () => {
  const { dir, service } = make();
  assert.equal(service.getState().mode, 'columns');
  service.importRoster(PEOPLE);
  assert.deepEqual(service.getRoster().map((p) => p.id), ['p1', 'p2', 'p3']);
  assert.equal(service.getState().mode, 'names');
  assert.equal(make(dir).service.getRoster().length, 3, 'kept after a restart');
});

test('marking by name totals households and unnamed visitors', () => {
  const { service } = make();
  service.importRoster(PEOPLE);
  service.mark('p2', 'kh', undefined, 't1');
  service.mark('p1', 'zoom', undefined, 't2');
  service.unnamed(1, 't3');
  assert.deepEqual(service.getState().totals, { hall: 3, zoom: 1, total: 4 });
  assert.throws(() => service.mark('p99', 'kh'), { code: 'BAD_MARK' });
});

test('two phones marking the same person: one mark, last tap wins, retries count once', () => {
  const { service } = make();
  service.importRoster(PEOPLE);
  service.mark('p1', 'kh', undefined, 'phoneA-1');
  service.mark('p1', 'zoom', undefined, 'phoneB-1');
  service.mark('p1', 'kh', undefined, 'phoneA-1'); // phone A retries after a Wi-Fi blip
  assert.deepEqual(service.getState().meeting.marks, { p1: { where: 'zoom', n: 1 } });
  assert.deepEqual(service.getState().totals, { hall: 0, zoom: 1, total: 1 });
});

test('a visitor added during the meeting is marked and kept in that meeting only', () => {
  const { service } = make();
  service.importRoster(PEOPLE);
  service.addVisitor('Ocampo, Rey', 'zoom');
  const s = service.getState();
  assert.deepEqual(s.visitors, [{ id: 'v1', name: 'Ocampo, Rey' }]);
  assert.equal(s.totals.zoom, 1);
  assert.equal(service.getRoster().length, 3, 'not added to the list');
});

test('history keeps the names as they were, even after the list changes', () => {
  const { service } = make();
  service.importRoster(PEOPLE);
  service.mark('p3', 'kh');
  service.addVisitor('Ocampo, Rey', 'kh');
  service.finalize();
  service.unlock();
  service.removePerson('p3');
  const entry = service.store.listHistory()[0];
  assert.deepEqual(entry.people.map((p) => `${p.id} ${p.name} (${p.group})`), [
    'p1 Santos, Ana (Publishers)', 'p2 Reyes, Mark & Joy (Publishers)', 'p3 Lim, Grace (VISITORS)', 'v1 Ocampo, Rey (VISITORS)',
  ]);
  assert.deepEqual(entry.marks.p3, { where: 'kh', n: 1 });
  assert.equal(service.getState().meeting.marks.p3, undefined, "removed from today's marks");
});

test('adding a person takes the next id; uploading a new list clears today\'s marks', () => {
  const { service } = make();
  service.importRoster(PEOPLE);
  assert.equal(service.addPerson('Cruz, Lea', 'Publishers').id, 'p4');
  service.mark('p1', 'kh');
  service.importRoster(PEOPLE.slice(0, 1));
  assert.deepEqual(service.getState().meeting.marks, {});
  assert.throws(() => service.addPerson('  ', 'Publishers'), { code: 'BAD_NAME' });
});

test('files saved by 0.2.0 load, total, finalize and export as before', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'att-v1-'));
  const v1 = { date: '2026-11-01', type: 'weekend', lanes: { left: 30, center: 40, right: 20 }, zoom: 15, finalized: false, finalizedAt: null };
  fs.writeFileSync(path.join(dir, 'current.json'), JSON.stringify(v1));
  fs.writeFileSync(path.join(dir, 'meetings.json'), JSON.stringify([{ ...v1, date: '2026-10-28', type: 'midweek', finalized: true }]));
  const { service } = make(dir);
  assert.deepEqual(service.getState().totals, { hall: 90, zoom: 15, total: 105 });
  assert.equal(service.getState().mode, 'columns');
  service.finalize();
  assert.equal(service.store.historyCsv(), 'date,meeting,left,center,right,hall,zoom,total\n2026-11-01,weekend,30,40,20,90,15,105\n2026-10-28,midweek,30,40,20,90,15,105\n');
});

test('an invited family is added with its size and place, and counted for today', () => {
  const { service } = make();
  const p = service.addPerson('Ocampo family', 'Invited', { size: 4, where: 'zoom' });
  assert.deepEqual([p.group, p.size, p.where], ['Invited', 4, 'zoom']);
  assert.deepEqual(service.getState().meeting.marks[p.id], { where: 'zoom', n: 4 });
  assert.equal(service.getState().totals.zoom, 4);
});
