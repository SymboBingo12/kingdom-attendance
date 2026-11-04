'use strict';

// Keeps the congregation's two Google spreadsheets up to date after every finalized meeting.
// The History kept on this computer is the source of truth: a sync rebuilds the affected tabs from it, so
// a record changed after finalizing simply overwrites, and a failed sync is retried without losing anything.
// On connect it first looks for spreadsheets this app already made in that Google account (a new computer or
// account must not create a second pair) and asks before using them.

const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const { writeJsonAtomic, readJson } = require('../store');
const { createAuth } = require('./auth');
const { createGoogleApi, GoogleError } = require('./api');
const L = require('./layout');

class SyncError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const sheetUrl = (id) => `https://docs.google.com/spreadsheets/d/${id}`;
const same = (a, b) => a.date === b.date && a.type === b.type;

function createGoogleSync({ dataDir, getSettings, getHistory, fetch: doFetch = fetch, clientId, clientSecret, now = () => Date.now(), retryMs = 60 * 1000 }) {
  const events = new EventEmitter();
  const file = path.join(dataDir, 'google.json');
  let state = { tokens: null, email: '', files: null, queue: [], lastSyncAt: null, error: null, ...(readJson(file) || {}) };
  let connecting = false;
  let syncing = false;
  let choice = null; // existing spreadsheets found on connect, waiting for the user's answer
  let retry = null;

  const persist = () => {
    writeJsonAtomic(file, state);
    try { fs.chmodSync(file, 0o600); } catch { /* not supported on this system */ }
  };
  const change = () => events.emit('change', status());
  const patch = (p) => { state = { ...state, ...p }; persist(); };

  const auth = createAuth({ fetch: doFetch, clientId, clientSecret, now, load: () => state, save: patch });
  const api = createGoogleApi({ fetch: doFetch, getAccessToken: () => auth.accessToken() });
  const names = () => {
    const c = String(getSettings().congregation || '').trim();
    return { attendance: `Attendance | ${c}`, log: `Log for Attendance | ${c}`, congregation: c };
  };
  const brief = (f) => (f ? { id: f.id, name: f.name, url: sheetUrl(f.id) } : null);

  function status() {
    return {
      configured: auth.configured(),
      connected: !!(state.tokens && state.tokens.refresh_token),
      connecting,
      syncing,
      email: state.email,
      files: state.files ? { attendance: brief(state.files.attendance), log: brief(state.files.log) } : null,
      choice: choice ? { attendance: choice.attendance.map(brief), log: choice.log.map(brief) } : null,
      pending: state.queue.length,
      lastSyncAt: state.lastSyncAt,
      error: state.error,
    };
  }

  const describe = (err) => {
    if (err instanceof GoogleError && err.status === 0) return 'No internet connection to Google. It will try again.';
    if (err instanceof GoogleError && err.status === 401) return 'Google sign-in expired. Press Connect Google again.';
    if (err instanceof GoogleError && err.status === 403) return `Google said no: ${err.message}`;
    return err.message || 'Google sync failed.';
  };

  async function createFiles(n, which = ['attendance', 'log']) {
    const files = { ...(state.files || {}) };
    if (which.includes('attendance')) files.attendance = { id: await api.createSpreadsheet(n.attendance, [L.TAB.weekend, L.TAB.midweek]), name: n.attendance };
    if (which.includes('log')) {
      const id = await api.createSpreadsheet(n.log, [L.TAB.weekend, L.TAB.midweek, 'READ ME']);
      await api.writeRows(id, 'READ ME', L.readMeRows(n.congregation));
      files.log = { id, name: n.log };
    }
    patch({ files });
  }

  const backfill = () => patch({ queue: getHistory().map((m) => ({ date: m.date, type: m.type })) });

  async function discover() {
    const n = names();
    const [attendance, log] = await Promise.all([api.findByName(n.attendance), api.findByName(n.log)]);
    if (attendance.length || log.length) { choice = { attendance, log }; return; }
    await createFiles(n);
    backfill();
  }

  async function setup() {
    try {
      await discover();
      patch({ error: null });
    } catch (err) {
      patch({ error: describe(err) });
    }
    change();
    if (!choice) flush();
  }

  async function logTitle(type, year) {
    const id = state.files.log.id;
    const base = L.TAB[type];
    const tabs = await api.sheetsOf(id);
    const existing = tabs.find((t) => t.title === base);
    if (!existing) { await api.ensureSheet(id, base); return base; }
    const m = /SERVICE YEAR (\d{4})–\d{4}/.exec(await api.readCell(id, base));
    if (!m || Number(m[1]) === year) return base;
    const have = Number(m[1]);
    if (have < year) {
      // A new service year: the old tab is kept, renamed with its year, and a fresh one starts.
      const taken = tabs.some((t) => t.title === `${base} ${L.yearLabel(have)}`);
      await api.renameSheet(id, existing.sheetId, `${base} ${L.yearLabel(have)}${taken ? ' (old)' : ''}`);
      await api.ensureSheet(id, base);
      return base;
    }
    const archive = `${base} ${L.yearLabel(year)}`;
    await api.ensureSheet(id, archive);
    return archive;
  }

  async function push(batch, history) {
    const { attendance, log } = state.files;
    for (const type of [...new Set(batch.map((b) => b.type))]) {
      const mine = history.filter((m) => m.type === type).sort((a, b) => b.date.localeCompare(a.date));
      if (mine[0] && batch.some((b) => same(b, mine[0]))) { // the tabs show the latest meeting of each kind
        await api.writeSheet(attendance.id, L.TAB[type], L.meetingSheet(mine[0]));
      }
    }
    for (const year of [...new Set(batch.map((b) => L.serviceYearOf(b.date)))]) {
      await api.writeSheet(attendance.id, L.recordTab(year), L.recordSheet(history, year));
    }
    const pairs = new Map(batch.map((b) => [`${b.type}|${L.serviceYearOf(b.date)}`, [b.type, L.serviceYearOf(b.date)]]));
    for (const [type, year] of [...pairs.values()].sort((a, b) => a[1] - b[1])) { // oldest year first, so a rollover archives in order
      await api.writeRows(log.id, await logTitle(type, year), L.logRows(history, type, year));
    }
  }

  async function run() {
    if (!(state.tokens && state.tokens.refresh_token) || choice) return;
    try {
      if (!state.files) { await discover(); if (choice || !state.files) return; }
      if (!state.queue.length) return;
      syncing = true;
      change();
      const batch = state.queue.slice();
      await push(batch, getHistory());
      patch({ queue: state.queue.filter((q) => !batch.some((b) => same(b, q))), lastSyncAt: new Date(now()).toISOString(), error: null });
    } catch (err) {
      patch({ error: describe(err), ...(err instanceof GoogleError && err.status === 401 ? { tokens: null } : {}) });
      if (retryMs && state.tokens) { clearTimeout(retry); retry = setTimeout(flush, retryMs); retry.unref(); }
    } finally {
      syncing = false;
      change();
    }
  }

  let chain = Promise.resolve();
  const flush = () => (chain = chain.then(run, run));

  return Object.assign(events, {
    status,
    flush,
    idle: () => chain,

    // "Sync now": rewrite every meeting from History, so sheets made by an older version get the current layout.
    resync() {
      if (state.tokens && state.files && !choice) { backfill(); change(); }
      return flush();
    },

    // Returns the Google page to open in a browser; the rest happens when the user comes back from it.
    async connect() {
      if (!auth.configured()) throw new SyncError('GOOGLE_NOT_SET_UP', "Google sign-in isn't set up in this build yet.");
      if (!names().congregation) throw new SyncError('GOOGLE_NO_NAME', 'Type the congregation name first (Settings → Attendance video).');
      const { url, done } = await auth.begin();
      connecting = true;
      change();
      done.then(({ email }) => { patch({ email, error: null }); connecting = false; return setup(); })
        .catch((err) => { connecting = false; patch({ error: describe(err) }); change(); });
      return { url };
    },

    // The answer to "Use the existing sheets?".
    async choose(useExisting) {
      if (!choice) throw new SyncError('GOOGLE_NO_CHOICE', 'There is nothing to choose.');
      const n = names();
      const found = choice;
      choice = null;
      try {
        const files = {};
        if (useExisting && found.attendance[0]) files.attendance = { id: found.attendance[0].id, name: found.attendance[0].name };
        if (useExisting && found.log[0]) files.log = { id: found.log[0].id, name: found.log[0].name };
        patch({ files });
        await createFiles(n, ['attendance', 'log'].filter((k) => !files[k]));
        backfill();
        patch({ error: null });
      } catch (err) {
        choice = found;
        patch({ error: describe(err) });
      }
      change();
      if (!choice) flush();
    },

    async disconnect() {
      await auth.revoke();
      choice = null;
      clearTimeout(retry);
      patch({ tokens: null, email: '', files: null, queue: [], error: null });
      change();
    },

    // A meeting was finalized or changed: its tabs need rewriting.
    enqueue(date, type) {
      if (!(state.tokens && state.tokens.refresh_token)) return;
      if (!state.queue.some((q) => same(q, { date, type }))) patch({ queue: [...state.queue, { date, type }] });
      change();
      flush();
    },
  });
}

module.exports = { createGoogleSync, SyncError };
