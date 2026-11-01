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
    zoom: 0,
    finalized: false,
    finalizedAt: null,
  };
}

function assertOpen(m) {
  if (m.finalized) throw new MeetingError('LOCKED', 'Attendance is finalized. Unlock to change it.');
}

function applyTap(m, lane, delta) {
  if (!LANES.includes(lane)) throw new MeetingError('BAD_LANE', `Unknown column "${lane}".`);
  if (delta !== 1 && delta !== -1) throw new MeetingError('BAD_DELTA', 'A tap adds or removes one person.');
  assertOpen(m);
  return { ...m, lanes: { ...m.lanes, [lane]: Math.max(0, m.lanes[lane] + delta) } };
}

function setZoom(m, value) {
  const text = typeof value === 'string' ? value.trim() : value;
  const n = typeof text === 'number' ? text : (typeof text === 'string' && /^\d+$/.test(text) ? Number(text) : NaN);
  if (!Number.isInteger(n) || n < 0 || n > MAX_ZOOM) {
    throw new MeetingError('BAD_ZOOM', `Zoom must be a whole number from 0 to ${MAX_ZOOM}.`);
  }
  assertOpen(m);
  return { ...m, zoom: n };
}

function totals(m) {
  const hall = m.lanes.left + m.lanes.center + m.lanes.right;
  return { hall, zoom: m.zoom, total: hall + m.zoom };
}

function finalize(m, now) {
  return { ...m, finalized: true, finalizedAt: now.toISOString() };
}

function unlock(m) {
  return { ...m, finalized: false, finalizedAt: null };
}

function rollIfNewDay(m, now) {
  if (m.date === dateKey(now)) return { meeting: m, rolled: false };
  return { meeting: newMeeting(now), rolled: true };
}

module.exports = {
  LANES, MeetingError, dateKey, meetingType, newMeeting, applyTap, setZoom, totals, finalize, unlock, rollIfNewDay,
};
