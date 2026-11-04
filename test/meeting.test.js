'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  newMeeting, meetingType, applyTap, setZoom, totals, finalize, unlock, rollIfNewDay,
  upgrade, setHall, setMark, setCleaners, bumpUnnamed, addVisitor, dropMarks,
} = require('../src/core/meeting');

const sunday = new Date(2026, 10, 1); // Sun 1 Nov 2026

test('a new meeting starts at zero, typed from the weekday', () => {
  assert.deepEqual(newMeeting(sunday), {
    date: '2026-11-01', type: 'weekend', lanes: { left: 0, center: 0, right: 0 }, hall: 0, zoom: 0, finalized: false, finalizedAt: null, videoStale: false,
    marks: {}, unnamed: 0, visitors: [], cleaners: { restrooms: null, hall: null },
  });
  assert.equal(meetingType(new Date(2026, 10, 5)), 'midweek'); // Thu
  assert.equal(newMeeting(sunday, 'midweek').type, 'midweek');
});

test('taps add up per lane and totals include Zoom', () => {
  let m = applyTap(newMeeting(sunday), 'left', 1);
  m = applyTap(m, 'left', 1);
  m = applyTap(m, 'right', 1);
  assert.deepEqual(totals(setZoom(m, 23)), { hall: 3, zoom: 23, total: 26 });
});

test('a lane never goes below zero and the input is not mutated', () => {
  const m0 = newMeeting(sunday);
  assert.equal(applyTap(m0, 'center', -1).lanes.center, 0);
  applyTap(m0, 'left', 1);
  assert.equal(m0.lanes.left, 0);
});

test('bad Zoom values are rejected; numeric strings are accepted', () => {
  const m0 = newMeeting(sunday);
  for (const bad of ['', 'abc', -3, 12.5, 10000, null, undefined]) {
    assert.throws(() => setZoom(m0, bad), { code: 'BAD_ZOOM' }, `value ${String(bad)}`);
  }
  assert.equal(setZoom(m0, '19').zoom, 19);
  assert.equal(setZoom(m0, 0).zoom, 0);
});

test('bad lanes and deltas are rejected', () => {
  const m0 = newMeeting(sunday);
  assert.throws(() => applyTap(m0, 'balcony', 1), { code: 'BAD_LANE' });
  assert.throws(() => applyTap(m0, 'left', 5), { code: 'BAD_DELTA' });
});

test('a finalized meeting can still be changed', () => {
  let m = applyTap(applyTap(newMeeting(sunday), 'left', 1), 'left', 1);
  const f = finalize(m, new Date(2026, 10, 1, 11, 45));
  assert.equal(f.finalized, true);
  assert.ok(f.finalizedAt);
  assert.equal(applyTap(f, 'left', 1).lanes.left, 3);
  assert.equal(setZoom(f, 3).zoom, 3);
  const u = unlock(f);
  assert.equal(u.finalized, false);
  assert.equal(applyTap(u, 'left', 1).lanes.left, 3);
});

test('a new day starts a new meeting', () => {
  const m = applyTap(newMeeting(sunday), 'left', 1);
  assert.equal(rollIfNewDay(m, new Date(2026, 10, 1, 21)).rolled, false);
  assert.equal(rollIfNewDay(m, new Date(2026, 10, 1, 21)).meeting, m);
  const r = rollIfNewDay(m, new Date(2026, 10, 5, 19));
  assert.equal(r.rolled, true);
  assert.equal(r.meeting.date, '2026-11-05');
  assert.equal(r.meeting.type, 'midweek');
  assert.equal(r.meeting.lanes.left, 0);
});

// ---- Marking by name ----

test('a meeting saved by 0.2.0 (no marks) totals exactly as before', () => {
  const v1 = { date: '2026-10-28', type: 'midweek', lanes: { left: 3, center: 4, right: 5 }, zoom: 2, finalized: true, finalizedAt: 'x' };
  assert.deepEqual(totals(v1), { hall: 12, zoom: 2, total: 14 });
  assert.deepEqual(upgrade(v1).marks, {});
  assert.equal(upgrade(v1).unnamed, 0);
});

test('marks count households at the hall or on Zoom, and can move or clear', () => {
  let m = setMark(newMeeting(sunday), 'p1', 'kh', 2);
  m = setMark(m, 'p2', 'zoom');
  assert.deepEqual(totals(m), { hall: 2, zoom: 1, total: 3 });
  m = setMark(m, 'p1', 'zoom');
  assert.deepEqual(m.marks.p1, { where: 'zoom', n: 2 }, 'moving keeps the household size');
  m = setMark(m, 'p1', null);
  assert.equal(m.marks.p1, undefined);
  assert.deepEqual(totals(m), { hall: 0, zoom: 1, total: 1 });
});

test('unnamed visitors count toward the hall and never go below zero', () => {
  let m = bumpUnnamed(newMeeting(sunday), 1);
  m = bumpUnnamed(bumpUnnamed(m, 1), -1);
  assert.equal(totals(m).hall, 1);
  assert.equal(bumpUnnamed(bumpUnnamed(m, -1), -1).unnamed, 0);
  assert.throws(() => bumpUnnamed(m, 2), { code: 'BAD_DELTA' });
});

test('visitors added during the meeting get their own ids and can be marked', () => {
  const a = addVisitor(newMeeting(sunday), '  Lim, Grace ');
  const b = addVisitor(a.meeting, 'Ocampo family');
  assert.deepEqual([a.id, b.id], ['v1', 'v2']);
  assert.deepEqual(b.meeting.visitors, [{ id: 'v1', name: 'Lim, Grace' }, { id: 'v2', name: 'Ocampo family' }]);
  assert.equal(totals(setMark(b.meeting, 'v2', 'kh', 3)).hall, 3);
  assert.throws(() => addVisitor(newMeeting(sunday), '   '), { code: 'BAD_NAME' });
  assert.throws(() => addVisitor(newMeeting(sunday), 'x'.repeat(81)), { code: 'BAD_NAME' });
});

test('marks can still be changed once finalized', () => {
  const m = finalize(newMeeting(sunday), sunday);
  assert.equal(setMark(m, 'p1', 'kh').marks.p1.where, 'kh');
  assert.equal(bumpUnnamed(m, 1).unnamed, 1);
  assert.equal(addVisitor(m, 'Lim').meeting.visitors.length, 1);
});

test('bad marks are refused', () => {
  const m = newMeeting(sunday);
  assert.throws(() => setMark(m, 'p1', 'roof'), { code: 'BAD_MARK' });
  assert.throws(() => setMark(m, 'p1', 'kh', 0), { code: 'BAD_MARK' });
  assert.throws(() => setMark(m, 'p1', 'kh', 21), { code: 'BAD_MARK' });
  assert.throws(() => setMark(m, '', 'kh'), { code: 'BAD_MARK' });
});

test('dropping marks keeps only the people still on the list', () => {
  let m = setMark(setMark(newMeeting(sunday), 'p1', 'kh'), 'p2', 'zoom');
  m = setMark(addVisitor(m, 'Lim').meeting, 'v1', 'kh');
  assert.deepEqual(Object.keys(dropMarks(m, new Set(['p2'])).marks).sort(), ['p2', 'v1'], 'visitors are kept');
});

test('cleaning groups are 1 to 5 per area, can be cleared, and can change after finalizing', () => {
  const m = setCleaners(newMeeting(sunday), { restrooms: 2, hall: 3 });
  assert.deepEqual(m.cleaners, { restrooms: 2, hall: 3 });
  assert.deepEqual(setCleaners(m, { hall: null }).cleaners, { restrooms: 2, hall: null }, 'the other area is kept');
  assert.deepEqual(setCleaners(finalize(m, sunday), { restrooms: 5 }).cleaners, { restrooms: 5, hall: 3 });
  for (const bad of [0, 6, 1.5, '2', NaN]) assert.throws(() => setCleaners(m, { restrooms: bad }), { code: 'BAD_CLEANERS' });
  assert.deepEqual(upgrade({ date: '2026-10-28', type: 'midweek', lanes: { left: 1, center: 0, right: 0 }, zoom: 0 }).cleaners, { restrooms: null, hall: null }, 'older meetings load');
});

test('counting overall: the typed Kingdom Hall total is added to the totals', () => {
  const m = setZoom(setHall(newMeeting(new Date(2026, 10, 4)), 42), 7);
  assert.deepEqual(totals(m), { hall: 42, zoom: 7, total: 49 });
  assert.equal(totals(setHall(m, '30')).hall, 30);
  assert.throws(() => setHall(m, -1), { code: 'BAD_HALL' });
  assert.throws(() => setHall(m, 'x'), { code: 'BAD_HALL' });
  const old = newMeeting(new Date(2026, 10, 4));
  delete old.hall;
  assert.equal(totals(old).hall, 0, 'a meeting saved before this setting still counts');
});
