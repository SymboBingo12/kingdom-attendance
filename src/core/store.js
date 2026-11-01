'use strict';

// Saves the meeting in progress, the history of finalized meetings and the congregation's publisher list.
// Names stay in this folder on the AV computer; the CSV export is numbers only.
// Every write goes to a .tmp file first and is then renamed over the real one, so a crash
// or power cut mid-write never leaves a half-written file.

const fs = require('node:fs');
const path = require('node:path');
const { totals } = require('./meeting');

const CSV_HEADER = 'date,meeting,left,center,right,hall,zoom,total';

function writeJsonAtomic(file, value) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}

// Returns null for a missing file. A file that can't be parsed is renamed aside so it can be inspected later.
function readJson(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    const base = path.basename(file, '.json');
    fs.renameSync(file, path.join(path.dirname(file), `${base}.corrupt-${Date.now()}.json`));
    return null;
  }
}

function createStore(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const currentFile = path.join(dir, 'current.json');
  const historyFile = path.join(dir, 'meetings.json');
  const rosterFile = path.join(dir, 'publishers.json');

  const listHistory = () => {
    const list = readJson(historyFile);
    return (Array.isArray(list) ? list : []).sort((a, b) => b.date.localeCompare(a.date));
  };

  return {
    loadCurrent: () => readJson(currentFile),
    loadRoster: () => { const list = readJson(rosterFile); return Array.isArray(list) ? list : []; },
    saveRoster: (list) => writeJsonAtomic(rosterFile, list),
    saveCurrent: (m) => writeJsonAtomic(currentFile, m),
    listHistory,
    upsertHistory(m) {
      const rest = listHistory().filter((h) => !(h.date === m.date && h.type === m.type));
      writeJsonAtomic(historyFile, [...rest, m]);
    },
    historyCsv() {
      const rows = listHistory().map((m) => {
        const t = totals(m);
        return [m.date, m.type, m.lanes.left, m.lanes.center, m.lanes.right, t.hall, t.zoom, t.total].join(',');
      });
      return `${[CSV_HEADER, ...rows].join('\n')}\n`;
    },
  };
}

module.exports = { createStore, writeJsonAtomic, readJson };
