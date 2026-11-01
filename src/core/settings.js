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
  theme: 'light',
  openAtLogin: true,
};

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

module.exports = { DEFAULTS, loadSettings, saveSettings, newPin };
