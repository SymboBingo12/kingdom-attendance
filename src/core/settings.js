'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { writeJsonAtomic, readJson } = require('./store');

const DEFAULTS = {
  port: 4590,
  hostname: 'attendance',
  localNoPin: true,
  congregation: '',
  m3Folder: '',
  theme: 'light', // the video's colours
  appearance: 'light', // the app's own colours: light (Caio's default), dark, or auto (follow the device)
  openAtLogin: true,
  autoUpdate: true, // download new versions from GitHub; installed on quit or "Restart and update"
};

const APPEARANCES = ['light', 'dark', 'auto'];
const appearanceOf = (s) => (APPEARANCES.includes(s.appearance) ? s.appearance : 'light');

const newPin = () => String(crypto.randomInt(0, 10000)).padStart(4, '0');

function loadSettings(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'settings.json');
  const saved = readJson(file) || {};
  const settings = { ...DEFAULTS, ...saved };
  if (!/^\d{4}$/.test(settings.pin || '')) {
    settings.pin = newPin();
    writeJsonAtomic(file, settings);
  }
  return settings;
}

function saveSettings(dir, patch) {
  const settings = { ...loadSettings(dir), ...patch };
  writeJsonAtomic(path.join(dir, 'settings.json'), settings);
  return settings;
}

module.exports = { DEFAULTS, APPEARANCES, appearanceOf, loadSettings, saveSettings, newPin };
