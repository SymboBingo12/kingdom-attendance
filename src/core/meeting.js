'use strict';

// The rules for one meeting's count. Pure functions: they return new objects and never change their input.

const LANES = ['left', 'center', 'right'];
const MAX_ZOOM = 9999;

class MeetingError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const pad = (n) => String(n).padStart(2, '0');

// Local calendar date, so a meeting at 7 pm doesn't land on the next day in UTC.
function dateKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function meetingType(d) {
  const day = d.getDay();
  return day === 0 || day === 6 ? 'weekend' : 'midweek';
}

function newMeeting(d, type) {
  return {
    date: dateKey(d),
    type: type || meetingType(d),
    lanes: { left: 0, center: 0, right: 0 },
    hall: 0, // the Kingdom Hall total typed in when counting overall (Settings → Counting)
    zoom: 0,
    finalized: false,
    finalizedAt: null,
    videoStale: false, // changed after it was finalized: the video no longer matches
    marks: {}, // person id -> { where: 'kh' | 'zoom', n } when counting by name
    unnamed: 0, // people at the hall nobody knows by name
    visitors: [], // { id: 'v1', name } added during this meeting only
    cleaners: { restrooms: null, hall: null }, // field service group numbers (1-5) cleaning today, for the video's last slide
  };
}

// Meetings saved by 0.2.0 have no name fields; they count exactly as before.
function upgrade(m) {
  if (m.marks && m.visitors && typeof m.unnamed === 'number' && m.cleaners && typeof m.hall === 'number') return m;
  return { hall: 0, marks: {}, unnamed: 0, visitors: [], cleaners: { restrooms: null, hall: null }, ...m };
}

const MAX_HOUSEHOLD = 20;
const MAX_NAME = 80;

function applyTap(m, lane, delta) {
  if (!LANES.includes(lane)) throw new MeetingError('BAD_LANE', `Unknown column "${lane}".`);
  if (delta !== 1 && delta !== -1) throw new MeetingError('BAD_DELTA', 'A tap adds or removes one person.');
  return { ...m, lanes: { ...m.lanes, [lane]: Math.max(0, m.lanes[lane] + delta) } };
}

function whole(value, label) {
  const text = typeof value === 'string' ? value.trim() : value;
  const n = typeof text === 'number' ? text : (typeof text === 'string' && /^\d+$/.test(text) ? Number(text) : NaN);
  if (!Number.isInteger(n) || n < 0 || n > MAX_ZOOM) throw new MeetingError(`BAD_${label.toUpperCase()}`, `${label} must be a whole number from 0 to ${MAX_ZOOM}.`);
  return n;
}

// Counting overall: the Kingdom Hall total typed in as one number.
function setHall(m, value) {
  return { ...m, hall: whole(value, 'Hall') };
}

function setZoom(m, value) {
  const text = typeof value === 'string' ? value.trim() : value;
  const n = typeof text === 'number' ? text : (typeof text === 'string' && /^\d+$/.test(text) ? Number(text) : NaN);
  if (!Number.isInteger(n) || n < 0 || n > MAX_ZOOM) {
    throw new MeetingError('BAD_ZOOM', `Zoom must be a whole number from 0 to ${MAX_ZOOM}.`);
  }
  return { ...m, zoom: n };
}

// Marks one person at the hall or on Zoom (n people for a household), or clears them with where = null.
// Moving a person keeps their household size unless n is given.
function setMark(m, id, where, n) {
  if (typeof id !== 'string' || !id) throw new MeetingError('BAD_MARK', 'Unknown person.');
  if (where !== 'kh' && where !== 'zoom' && where !== null) throw new MeetingError('BAD_MARK', 'Mark someone at the Kingdom Hall or on Zoom.');
  if (n !== undefined && (!Number.isInteger(n) || n < 1 || n > MAX_HOUSEHOLD)) throw new MeetingError('BAD_MARK', `A household is 1 to ${MAX_HOUSEHOLD} people.`);
  const up = upgrade(m);
  const marks = { ...up.marks };
  if (where === null) delete marks[id];
  else marks[id] = { where, n: n || (marks[id] && marks[id].n) || 1 };
  return { ...up, marks };
}

// Which field service group (1-5, or null for none) cleans the restrooms and the hall.
const GROUPS = [1, 2, 3, 4, 5];
function setCleaners(m, { restrooms, hall }) {
  const ok = (v) => v === null || v === undefined || GROUPS.includes(v);
  if (!ok(restrooms) || !ok(hall)) throw new MeetingError('BAD_CLEANERS', 'A field service group is 1 to 5.');
  const up = upgrade(m);
  return { ...up, cleaners: { restrooms: restrooms === undefined ? up.cleaners.restrooms : restrooms, hall: hall === undefined ? up.cleaners.hall : hall } };
}

function bumpUnnamed(m, delta) {
  if (delta !== 1 && delta !== -1) throw new MeetingError('BAD_DELTA', 'A tap adds or removes one person.');
  const up = upgrade(m);
  return { ...up, unnamed: Math.max(0, up.unnamed + delta) };
}

function addVisitor(m, name) {
  const clean = typeof name === 'string' ? name.trim() : '';
  if (!clean || clean.length > MAX_NAME) throw new MeetingError('BAD_NAME', `Type a name of 1 to ${MAX_NAME} letters.`);
  const up = upgrade(m);
  const id = `v${up.visitors.reduce((max, v) => Math.max(max, Number(v.id.slice(1)) || 0), 0) + 1}`;
  return { meeting: { ...up, visitors: [...up.visitors, { id, name: clean }] }, id };
}

// Keeps the marks of people still on the list (and of this meeting's visitors).
function dropMarks(m, keepIds) {
  const up = upgrade(m);
  const marks = Object.fromEntries(Object.entries(up.marks).filter(([id]) => id.startsWith('v') || keepIds.has(id)));
  return { ...up, marks };
}

function totals(m) {
  const up = upgrade(m);
  let hall = up.lanes.left + up.lanes.center + up.lanes.right + up.hall + up.unnamed;
  let zoom = up.zoom;
  for (const { where, n } of Object.values(up.marks)) {
    if (where === 'kh') hall += n;
    else zoom += n;
  }
  return { hall, zoom, total: hall + zoom };
}

function finalize(m, now) {
  return { ...m, finalized: true, finalizedAt: now.toISOString(), videoStale: false };
}

function unlock(m) {
  return { ...m, finalized: false, finalizedAt: null };
}

function rollIfNewDay(m, now) {
  if (m.date === dateKey(now)) return { meeting: m, rolled: false };
  return { meeting: newMeeting(now), rolled: true };
}

module.exports = {
  LANES, MeetingError, dateKey, meetingType, newMeeting, applyTap, setHall, setZoom, totals, finalize, unlock, rollIfNewDay,
  upgrade, setMark, setCleaners, bumpUnnamed, addVisitor, dropMarks,
};
