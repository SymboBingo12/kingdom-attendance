'use strict';

// Reads a congregation's publisher list from an Excel file, a CSV or pasted lines. It understands the
// attendance-sheet layout (names in the first column, a capitalised line such as "CLMS" or "INVITED THRU ZOOM"
// starting a group, totals at the bottom) and a simple template with Name and Group columns.

const ExcelJS = require('exceljs');

const MAX_LIST_BYTES = 5 * 1024 * 1024;
const TEMPLATE_CSV = 'Publishers,Unbaptized publishers\n"Santos, Ana","Navarro, Ella"\n"Reyes, Mark & Joy","Castillo, Ian"\n"Cruz, Lea",\n';
const PUBLISHERS = 'Publishers';
const UNBAPTIZED = 'Unbaptized publishers';
const INVITED = 'Invited';
const GROUP_WORDS = /\b(CLMS|VISITORS?|INVITED|GUESTS?|STUDENTS?|GROUP|PUBLISHERS|INTERESTED)\b/;
const BAD_FILE = "That file couldn't be read. Save it as .xlsx or .csv and try again.";

class RosterError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// "Reyes, Mark & Joy" or "Angel / Remart" is a household of two; the attendant can change it when marking.
const householdSize = (name) => (/&|\/|\s-\s|\sand\s/i.test(name) ? 2 : 1);

// "UNBAPTIZED PUBLISHERS" and "INVITED" are the congregation's own groups; any other capitalised line keeps its words.
const groupName = (text) => (/^publishers?$/i.test(text) ? PUBLISHERS : /^unbaptized publishers?$/i.test(text) ? UNBAPTIZED : /^invited$/i.test(text) ? INVITED : text);

const isGroupLine = (text) => !/[a-z]/.test(text) && GROUP_WORDS.test(text);

function parseRows(rows) {
  const clean = rows.map((r) => (Array.isArray(r) ? r : [r]).map((c) => String(c == null ? '' : c).trim()));
  const first = (r) => r.find((c) => c) || '';

  // The template: a Publishers column and an Unbaptized publishers column, names listed down each.
  const cols = clean.findIndex((r) => r.some((c) => /^publishers?$/i.test(c)) && r.some((c) => /^unbaptized publishers?$/i.test(c)));
  if (cols >= 0) {
    const pi = clean[cols].findIndex((c) => /^publishers?$/i.test(c));
    const ui = clean[cols].findIndex((c) => /^unbaptized publishers?$/i.test(c));
    const people = [];
    for (const r of clean.slice(cols + 1)) {
      for (const [i, group] of [[pi, PUBLISHERS], [ui, UNBAPTIZED]]) if (i >= 0 && r[i]) people.push({ name: r[i], group, size: householdSize(r[i]) });
    }
    return people;
  }

  const head = clean.findIndex((r) => r.some((c) => /^name$/i.test(c)));
  if (head >= 0) {
    const ni = clean[head].findIndex((c) => /^name$/i.test(c));
    const gi = clean[head].findIndex((c) => /^group$/i.test(c));
    return clean.slice(head + 1).filter((r) => r[ni])
      .map((r) => ({ name: r[ni], group: (gi >= 0 && r[gi]) || 'Publishers', size: householdSize(r[ni]) }));
  }

  // Names sit in the column of the "PUBLISHER" heading, or the first column when there is none.
  // A summary sheet with figures in other columns therefore gives no names.
  const start = clean.findIndex((r) => /^publishers?$/i.test(first(r)));
  const col = start >= 0 ? clean[start].findIndex((c) => c) : 0;
  const people = [];
  let group = 'Publishers';
  for (const r of clean.slice(start + 1)) {
    const text = r[col] || '';
    if (!text) continue;
    if (/^sub-?total/i.test(text) || /^(grand total|total)$/i.test(text)) break;
    if (/^total\b/i.test(text) || /^[=\d.\s]+$/.test(text)) continue;
    if (isGroupLine(text)) { group = groupName(text); continue; }
    people.push({ name: text, group, size: householdSize(text) });
  }
  return people;
}

// Splits CSV text into rows of cells, honouring quotes ("Santos, Ana").
function csvRows(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false; else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// exceljs throws on an empty merged cell; such a cell is simply blank.
function cellText(cell) {
  try {
    return cell.text;
  } catch {
    return '';
  }
}

async function readListFile(buf, filename = '') {
  if (!buf || !buf.length || buf.length > MAX_LIST_BYTES) throw new RosterError('BAD_FILE', BAD_FILE);
  const ext = (String(filename).match(/\.[^.]+$/) || [''])[0].toLowerCase();
  if (ext === '.csv') return { sheets: [{ name: filename, people: parseRows(csvRows(buf.toString('utf8').replace(/^﻿/, ''))) }] };
  if (ext !== '.xlsx') throw new RosterError('BAD_FILE', BAD_FILE);

  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buf);
  } catch {
    throw new RosterError('BAD_FILE', BAD_FILE);
  }
  const sheets = wb.worksheets.map((ws) => {
    const rows = [];
    for (let r = 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const cells = [];
      for (let c = 1; c <= row.cellCount; c++) cells.push(cellText(row.getCell(c)));
      rows.push(cells);
    }
    return { name: ws.name, people: parseRows(rows) };
  });
  return { sheets };
}

module.exports = { PUBLISHERS, UNBAPTIZED, INVITED, householdSize, parseRows, readListFile, RosterError, TEMPLATE_CSV, MAX_LIST_BYTES, BAD_FILE };
