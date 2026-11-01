'use strict';

// Keeps the installed app up to date from its GitHub releases. The updater (electron-updater's
// autoUpdater) is passed in, so tests can use a fake one.
//
// The app runs during meetings, so it never restarts by itself: a new version downloads quietly
// and is installed when the app is quit, or when someone presses "Restart and update" (refused
// while the video is being made).
//
// status().state: unsupported | idle | checking | current | downloading | ready | error

const { EventEmitter } = require('node:events');

const FIRST_CHECK_MS = 15 * 1000;
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

function createUpdates({ updater, reason = '', isEnabled = () => true, isBusy = () => false }) {
  const events = new EventEmitter();
  let status = { state: updater ? 'idle' : 'unsupported', message: updater ? '' : reason, version: null, percent: 0 };
  const timers = [];

  const set = (patch) => {
    status = { ...status, ...patch };
    events.emit('change', { ...status });
  };

  if (updater) {
    updater.autoDownload = true;
    updater.autoInstallOnAppQuit = true;
    updater.logger = null;
    updater.on('checking-for-update', () => set({ state: 'checking', message: '' }));
    updater.on('update-available', (info) => set({ state: 'downloading', version: info.version, percent: 0 }));
    updater.on('update-not-available', () => set({ state: 'current' }));
    updater.on('download-progress', (p) => set({ state: 'downloading', percent: Math.round(p.percent || 0) }));
    updater.on('update-downloaded', (info) => set({ state: 'ready', version: info.version, percent: 100 }));
    updater.on('error', (err) => {
      if (status.state === 'ready') return; // the downloaded version can still be installed
      const first = String((err && err.message) || err).split('\n')[0].trim();
      set({ state: 'error', message: /^(HttpError: )?404\b/.test(first) ? 'no versions have been published yet.' : first.slice(0, 200) });
    });
  }

  async function check() {
    if (!updater || ['checking', 'downloading', 'ready'].includes(status.state)) return;
    try {
      await updater.checkForUpdates();
    } catch {
      // reported through the 'error' event
    }
  }

  return Object.assign(events, {
    status: () => ({ ...status }),
    check,

    // Checks soon after start, then every few hours, while "Update automatically" is on.
    start() {
      if (!updater) return;
      const auto = () => { if (isEnabled()) check(); };
      timers.push(setTimeout(auto, FIRST_CHECK_MS), setInterval(auto, CHECK_EVERY_MS));
      for (const t of timers) if (t.unref) t.unref();
    },

    stop() {
      for (const t of timers) { clearTimeout(t); clearInterval(t); }
      timers.length = 0;
    },

    // Quits and installs a downloaded update, then opens the app again.
    install() {
      if (status.state !== 'ready' || isBusy()) return false;
      updater.quitAndInstall(true, true);
      return true;
    },
  });
}

module.exports = { createUpdates, FIRST_CHECK_MS, CHECK_EVERY_MS };
