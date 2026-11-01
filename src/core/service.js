'use strict';

// The one place the meeting lives. Every change is saved to disk before anyone is told about it,
// so a restart mid-meeting comes back with the same numbers.

const { EventEmitter } = require('node:events');
const M = require('./meeting');
const { createStore } = require('./store');
const { loadSettings } = require('./settings');

const TYPES = ['midweek', 'weekend'];
const SEEN_TAPS = 1000;

function busy() {
  return new M.MeetingError('BUSY', 'Still making the video.');
}

function createService({ dataDir, now = () => new Date(), getSettings = () => loadSettings(dataDir), renderer = null, deliver = null }) {
  const events = new EventEmitter();
  events.setMaxListeners(0);
  const store = createStore(dataDir);
  let meeting = store.loadCurrent() || M.newMeeting(now());
  let render = { status: 'idle', message: '', savedTo: null };

  // Phones may resend a tap after a Wi-Fi blip; each tap id counts once.
  const seen = new Set();
  const seenOrder = [];
  const remember = (id) => {
    seen.add(id);
    seenOrder.push(id);
    if (seenOrder.length > SEEN_TAPS) seen.delete(seenOrder.shift());
  };

  const getState = () => {
    const s = getSettings();
    return { meeting, totals: M.totals(meeting), render, congregation: s.congregation || '', theme: s.theme || 'light' };
  };

  const commit = (next) => {
    meeting = next;
    store.saveCurrent(meeting);
    events.emit('change', getState());
    return getState();
  };

  const today = () => M.rollIfNewDay(meeting, now()).meeting;

  const setRender = (patch) => {
    render = { ...render, ...patch };
    events.emit('change', getState());
  };

  // Makes the video and hands it to M³ in the background; the dock follows render.status.
  let pipeline = Promise.resolve();
  async function makeVideo() {
    const s = getSettings();
    setRender({ status: 'rendering', message: 'Making the video…', savedTo: null });
    try {
      const files = await renderer({ meeting, totals: M.totals(meeting), congregation: s.congregation || '', theme: s.theme || 'light' });
      const out = await deliver({ mp4: files.mp4, dateKey: meeting.date });
      setRender({ status: 'ready', savedTo: out.savedTo, message: out.fallback ? `Saved to Desktop (${out.reason})` : 'Ready in M³' });
    } catch (err) {
      setRender({ status: 'error', savedTo: null, message: `Couldn't make the video: ${err.message}. The numbers are saved. Try Make video again.` });
    }
  }
  const startVideo = () => {
    if (renderer && deliver) pipeline = makeVideo();
  };

  const isRendering = () => render.status === 'rendering';

  return Object.assign(events, {
    getState,
    store,

    tap(lane, delta, tapId) {
      if (tapId && seen.has(tapId)) return getState();
      const state = commit(M.applyTap(today(), lane, delta));
      if (tapId) remember(tapId);
      return state;
    },

    setZoom(value) {
      return commit(M.setZoom(today(), value));
    },

    // Locks the numbers, records them in history and starts the video.
    finalize() {
      if (isRendering()) throw busy();
      commit(M.finalize(meeting, now()));
      store.upsertHistory(meeting);
      startVideo();
      return getState();
    },

    rerender() {
      if (isRendering()) throw busy();
      if (!meeting.finalized) throw new M.MeetingError('NOT_FINAL', 'Finalize the attendance first.');
      startVideo();
      return getState();
    },

    // Resolves when the current video (if any) is done; for tests and the app's quit handler.
    idle: () => pipeline,

    unlock() {
      if (isRendering()) throw busy();
      render = { status: 'idle', message: '', savedTo: null };
      return commit(M.unlock(meeting));
    },

    newMeeting(type) {
      if (isRendering()) throw busy();
      if (type !== undefined && !TYPES.includes(type)) throw new M.MeetingError('BAD_TYPE', 'Meeting must be midweek or weekend.');
      render = { status: 'idle', message: '', savedTo: null };
      return commit(M.newMeeting(now(), type));
    },

    setType(type) {
      if (!TYPES.includes(type)) throw new M.MeetingError('BAD_TYPE', 'Meeting must be midweek or weekend.');
      return commit({ ...meeting, type });
    },
  });
}

module.exports = { createService };
