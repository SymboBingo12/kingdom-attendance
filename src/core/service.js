'use strict';

// The one place the meeting lives. Every change is saved to disk before anyone is told about it,
// so a restart mid-meeting comes back with the same numbers.

const { EventEmitter } = require('node:events');
const M = require('./meeting');
const { createStore } = require('./store');
const { loadSettings, appearanceOf } = require('./settings');
const { householdSize } = require('./roster');

const TYPES = ['midweek', 'weekend'];
const SEEN_TAPS = 1000;

const MAX_NAME = 80;

function cleanPerson({ name, group, size, where }) {
  const n = typeof name === 'string' ? name.trim() : '';
  if (!n || n.length > MAX_NAME) throw new M.MeetingError('BAD_NAME', `Type a name of 1 to ${MAX_NAME} letters.`);
  const g = (typeof group === 'string' && group.trim().slice(0, MAX_NAME)) || 'Publishers';
  const person = { name: n, group: g, size: Number.isInteger(size) && size >= 1 && size <= 20 ? size : householdSize(n) };
  // Where an invited person usually attends.
  if (where === 'kh' || where === 'zoom') person.where = where;
  return person;
}

// The groups named on the video's last slide ("FSG 2"), or null when Announce cleaners is off.
function cleanersFor(settings, m) {
  if (!settings.announceCleaners) return null;
  const c = m.cleaners || {};
  return { restrooms: c.restrooms ? `FSG ${c.restrooms}` : '', hall: c.hall ? `FSG ${c.hall}` : '', hallName: settings.cleanersHallName || 'Kingdom Hall' };
}

function busy() {
  return new M.MeetingError('BUSY', 'Still making the video.');
}

function createService({ dataDir, now = () => new Date(), getSettings = () => loadSettings(dataDir), renderer = null, deliver = null }) {
  const events = new EventEmitter();
  events.setMaxListeners(0);
  const store = createStore(dataDir);
  let meeting = M.upgrade(store.loadCurrent() || M.newMeeting(now()));
  let roster = store.loadRoster();
  let render = { status: 'idle', message: '', savedTo: null };
  let sync = null; // Google Sheets sync, when the app has one

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
    return {
      meeting, totals: M.totals(meeting), render, congregation: s.congregation || '', theme: s.theme || 'light', appearance: appearanceOf(s),
      countMode: s.countMode === 'overall' ? 'overall' : 'sections', roster, visitors: meeting.visitors, mode: roster.length ? 'names' : 'columns',
      cleaners: cleanersFor(s, meeting),
      // Phones get only the headline; the account and links stay on the AV computer.
      google: sync ? (({ connected, pending, syncing, error }) => ({ connected, pending, syncing, error }))(sync.status()) : null,
    };
  };

  // A change to a finalized meeting overwrites its record in History and flags the video as out of date.
  const edit = (next) => {
    if (!next.finalized) return commit(next);
    const state = commit({ ...next, videoStale: true });
    store.upsertHistory({ ...meeting, people: snapshot() });
    if (sync) sync.enqueue(meeting.date, meeting.type);
    return state;
  };

  const commit = (next) => {
    meeting = next;
    store.saveCurrent(meeting);
    events.emit('change', getState());
    return getState();
  };

  const today = () => M.rollIfNewDay(meeting, now()).meeting;

  // The names used by today's meeting: the list, then visitors added today under the list's visitor group.
  const snapshot = () => {
    const visitorGroup = (roster.find((p) => /visitor/i.test(p.group)) || { group: 'Visitors' }).group;
    return [...roster, ...meeting.visitors.map((v) => ({ id: v.id, name: v.name, group: visitorGroup, size: 1 }))];
  };

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
      // With Announce cleaners on, the last slide also names the groups that clean.
      const cleaners = cleanersFor(s, meeting);
      const files = await renderer({ meeting, totals: M.totals(meeting), congregation: s.congregation || '', theme: s.theme || 'light', cleaners });
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

    setSync(s) {
      sync = s;
      s.on('change', () => events.emit('change', getState()));
    },

    tap(lane, delta, tapId) {
      if (tapId && seen.has(tapId)) return getState();
      const state = edit(M.applyTap(today(), lane, delta));
      if (tapId) remember(tapId);
      return state;
    },

    setHall(value) {
      return edit(M.setHall(today(), value));
    },

    setZoom(value) {
      return edit(M.setZoom(today(), value));
    },

    // ---- Counting by name ----

    getRoster: () => roster,

    // A new list replaces the old one; today's marks no longer match it, so they are cleared.
    importRoster(people) {
      if (!Array.isArray(people) || !people.length) throw new M.MeetingError('BAD_LIST', 'The list has no names.');
      roster = people.map((p, i) => ({ id: `p${i + 1}`, ...cleanPerson(p) }));
      store.saveRoster(roster);
      return commit(meeting.finalized ? meeting : { ...meeting, marks: {} });
    },

    // An invited person or family comes with how many they are and where they attend; they are marked for
    // today's meeting straight away, so the count follows.
    addPerson(name, group, { size, where } = {}) {
      const next = roster.reduce((max, p) => Math.max(max, Number(p.id.slice(1)) || 0), 0) + 1;
      const person = { id: `p${next}`, ...cleanPerson({ name, group, size, where }) };
      roster = [...roster, person];
      store.saveRoster(roster);
      const m = today();
      if (person.where) edit(M.setMark(m, person.id, person.where, person.size));
      else commit(meeting);
      return person;
    },

    removePerson(id) {
      roster = roster.filter((p) => p.id !== id);
      store.saveRoster(roster);
      return commit(meeting.finalized ? meeting : M.dropMarks(meeting, new Set(roster.map((p) => p.id))));
    },

    mark(id, where, n, tapId) {
      if (tapId && seen.has(tapId)) return getState();
      const m = today();
      const person = roster.find((p) => p.id === id) || m.visitors.find((v) => v.id === id);
      if (!person) throw new M.MeetingError('BAD_MARK', 'Unknown person.');
      // A first mark counts the whole household; a later one keeps whatever the attendant set.
      const count = n !== undefined ? n : (m.marks[id] ? undefined : person.size || 1);
      const state = edit(M.setMark(m, id, where, count));
      if (tapId) remember(tapId);
      return state;
    },

    // The AV desk picks which field service groups (1-5) clean; a change after Finalize makes the video out of date.
    setCleaners(restrooms, hall) {
      return edit(M.setCleaners(today(), { restrooms, hall }));
    },

    unnamed(delta, tapId) {
      if (tapId && seen.has(tapId)) return getState();
      const state = edit(M.bumpUnnamed(today(), delta));
      if (tapId) remember(tapId);
      return state;
    },

    addVisitor(name, where) {
      const { meeting: m, id } = M.addVisitor(today(), name);
      return edit(where ? M.setMark(m, id, where) : m);
    },

    // Locks the numbers, records them in history (with the names as they are today) and starts the video.
    finalize() {
      if (isRendering()) throw busy();
      commit(M.finalize(meeting, now()));
      store.upsertHistory({ ...meeting, people: snapshot() });
      if (sync) sync.enqueue(meeting.date, meeting.type);
      startVideo();
      return getState();
    },

    rerender() {
      if (isRendering()) throw busy();
      if (!meeting.finalized) throw new M.MeetingError('NOT_FINAL', 'Finalize the attendance first.');
      commit({ ...meeting, videoStale: false });
      startVideo();
      return getState();
    },

    // Settings changed on the AV PC (such as the appearance): tell open pages.
    settingsChanged() {
      events.emit('change', getState());
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
