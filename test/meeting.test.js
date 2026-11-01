'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  newMeeting, meetingType, applyTap, setZoom, totals, finalize, unlock, rollIfNewDay,
} = require('../src/core/meeting');

const sunday = new Date(2026, 10, 1); // Sun 1 Nov 2026

test('a new meeting starts at zero, typed from the weekday', () => {
  assert.deepEqual(newMeeting(sunday), {
    date: '2026-11-01', type: 'weekend', lanes: { left: 0, center: 0, right: 0 }, zoom: 0, finalized: false, finalizedAt: null,
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

test('a finalized meeting is locked until unlocked', () => {
  let m = applyTap(applyTap(newMeeting(sunday), 'left', 1), 'left', 1);
  const f = finalize(m, new Date(2026, 10, 1, 11, 45));
  assert.equal(f.finalized, true);
  assert.ok(f.finalizedAt);
  assert.throws(() => applyTap(f, 'left', 1), { code: 'LOCKED' });
  assert.throws(() => setZoom(f, 3), { code: 'LOCKED' });
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
