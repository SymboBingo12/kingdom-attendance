'use strict';

// Made-up names only: real publisher lists never go into the repo.

const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const { householdSize, parseRows, readListFile, TEMPLATE_CSV, MAX_LIST_BYTES } = require('../src/core/roster');

const summary = (people) => people.map((p) => `${p.group}: ${p.name} (${p.size})`);

test('parses the attendance-sheet layout: groups, households, totals left out', () => {
  const rows = [
    ['RIVERSIDE (Oct. 28)'], ['PUBLISHER ', 'ZOOM', 'KINGDOM HALL'],
    ['Santos, Ana', '', 1], ['Reyes, Mark & Joy', '', 2], [],
    ['CLMS'], ['Navarro, Ella'],
    ['JW VISITORS ZOOM / KH'], ['Lim, Grace'],
    ['INVITED THRU ZOOM'], ['TECNO LH8'], ['KC & LIAH CRUZ'], ['Dela Rosa, Kim'],
    ['Total KH Visitors', '', 1], ['SUB-TOTAL', '=SUM(B3:B9)'], ['After, Total'],
  ];
  assert.deepEqual(summary(parseRows(rows)), [
    'Publishers: Santos, Ana (1)', 'Publishers: Reyes, Mark & Joy (2)',
    'CLMS: Navarro, Ella (1)',
    'JW VISITORS ZOOM / KH: Lim, Grace (1)',
    'INVITED THRU ZOOM: TECNO LH8 (1)', 'INVITED THRU ZOOM: KC & LIAH CRUZ (2)', 'INVITED THRU ZOOM: Dela Rosa, Kim (1)',
  ]);
});

test('households: "&", "/", " and " and " - " start at 2', () => {
  assert.equal(householdSize('Reyes, Mark & Joy'), 2);
  assert.equal(householdSize('Angel / Remart'), 2);
  assert.equal(householdSize('Hanzel - Carla'), 2);
  assert.equal(householdSize('Ben and Lia'), 2);
  assert.equal(householdSize('Ana-Marie Cruz'), 1);
  assert.equal(householdSize('Santos, Ana'), 1);
});

test('the blank template reads back as its Publishers and Unbaptized publishers columns', async () => {
  const { sheets } = await readListFile(Buffer.from(TEMPLATE_CSV), 'publisher-list-template.csv');
  assert.equal(sheets.length, 1);
  assert.deepEqual(summary(sheets[0].people), ['Publishers: Santos, Ana (1)', 'Unbaptized publishers: Navarro, Ella (1)', 'Publishers: Reyes, Mark & Joy (2)', 'Unbaptized publishers: Castillo, Ian (1)', 'Publishers: Cruz, Lea (1)']);
});

test('pasted lines: a line in capitals starts a group', () => {
  assert.deepEqual(summary(parseRows([['Ana'], [''], ['VISITORS'], ['Lim']])), ['Publishers: Ana (1)', 'VISITORS: Lim (1)']);
});

test('an Excel file with several sheets lists each with its people', async () => {
  const wb = new ExcelJS.Workbook();
  const mid = wb.addWorksheet('MIDWEEK');
  [['PUBLISHER', 'ZOOM', 'KINGDOM HALL'], ['Santos, Ana'], ['Cruz, Lea'], ['Torres, Jun'], ['SUB-TOTAL', { formula: 'SUM(B2:B4)' }]].forEach((r) => mid.addRow(r));
  const sum = wb.addWorksheet('SUMMARY');
  sum.getCell('B4').value = 'MIDWEEK MEETING';
  sum.getCell('C4').value = 32;
  const { sheets } = await readListFile(Buffer.from(await wb.xlsx.writeBuffer()), 'list.xlsx');
  assert.deepEqual(sheets.map((s) => [s.name, s.people.length]), [['MIDWEEK', 3], ['SUMMARY', 0]]);
});

test('empty merged cells (as in the attendance sheet) are read as blanks, not a crash', async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('WEEKEND');
  [['PUBLISHER'], ['Santos, Ana'], ['Cruz, Lea']].forEach((r) => ws.addRow(r));
  ws.mergeCells('A5:C6');
  ws.getCell('A8').value = 'Torres, Jun';
  const { sheets } = await readListFile(Buffer.from(await wb.xlsx.writeBuffer()), 'list.xlsx');
  assert.deepEqual(sheets[0].people.map((p) => p.name), ['Santos, Ana', 'Cruz, Lea', 'Torres, Jun']);
});

test('files that are not a list are refused with a plain reason', async () => {
  for (const [buf, name] of [[Buffer.alloc(0), 'a.xlsx'], [Buffer.from('%PDF-1.4 x'), 'a.xlsx'], [Buffer.from('x'), 'old.xls'], [Buffer.alloc(MAX_LIST_BYTES + 1), 'big.csv']]) {
    await assert.rejects(readListFile(buf, name), { code: 'BAD_FILE' }, name);
  }
});

test('capitalised UNBAPTIZED PUBLISHERS and INVITED lines start the matching groups', () => {
  assert.deepEqual(summary(parseRows([['PUBLISHERS'], ['Ana'], ['UNBAPTIZED PUBLISHERS'], ['Ella'], ['INVITED'], ['Lim']])),
    ['Publishers: Ana (1)', 'Unbaptized publishers: Ella (1)', 'Invited: Lim (1)']);
});
