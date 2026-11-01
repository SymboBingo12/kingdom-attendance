'use strict';

// The overseer's workbook, read back with exceljs. Made-up names only.

const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const { buildOverseerWorkbook } = require('../src/core/workbook');

const people = [
  { id: 'p1', name: 'Santos, Ana', group: 'Publishers', size: 1 },
  { id: 'p2', name: 'Reyes, Mark & Joy', group: 'Publishers', size: 2 },
  { id: 'p3', name: 'Navarro, Ella', group: 'CLMS', size: 1 },
  { id: 'v1', name: 'Lim, Grace', group: 'VISITORS', size: 1 },
];
const lanes0 = { left: 0, center: 0, right: 0 };
const weekend = {
  date: '2026-11-01', type: 'weekend', lanes: lanes0, zoom: 0, unnamed: 1, visitors: [], finalized: true, people,
  marks: { p1: { where: 'zoom', n: 1 }, p2: { where: 'kh', n: 2 }, v1: { where: 'kh', n: 1 } },
};
const midweek = (date, left) => ({ date, type: 'midweek', lanes: { left, center: 0, right: 0 }, zoom: 4, finalized: true });

async function load(history) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await buildOverseerWorkbook({ history, congregation: 'Riverside Congregation' }));
  return wb;
}
const rows = (ws) => {
  const out = [];
  ws.eachRow({ includeEmpty: true }, (r) => out.push([1, 2, 3].map((c) => r.getCell(c).value ?? '')));
  return out;
};

test('one sheet per meeting, newest first, then the summary', async () => {
  const wb = await load([weekend, midweek('2026-10-28', 90), midweek('2026-10-21', 86)]);
  assert.deepEqual(wb.worksheets.map((w) => w.name), ['WEEKEND MEETING (Nov 01)', 'MIDWEEK MEETING (Oct 28)', 'MIDWEEK MEETING (Oct 21)', 'SUMMARY (AVERAGE)']);
});

test('a meeting by name lists everyone at Zoom or the Kingdom Hall, like the attendance sheet', async () => {
  const wb = await load([weekend]);
  assert.deepEqual(rows(wb.worksheets[0]), [
    ['RIVERSIDE CONGREGATION (Sunday, November 1)', '', ''],
    ['PUBLISHER', 'ZOOM', 'KINGDOM HALL'],
    ['Santos, Ana', 1, ''],
    ['Reyes, Mark & Joy', '', 2],
    ['', '', ''], ['CLMS', '', ''],
    ['Navarro, Ella', '', ''],
    ['', '', ''], ['VISITORS', '', ''],
    ['Lim, Grace', '', 1],
    ['', '', ''],
    ['Unnamed visitors', '', 1],
    ['SUB-TOTAL', 1, 4],
    ['TOTAL', 5, ''],
  ]);
});

test('a meeting counted by column shows the columns and the typed Zoom total', async () => {
  const wb = await load([{ ...midweek('2026-10-28', 30), lanes: { left: 30, center: 25, right: 20 } }]);
  assert.deepEqual(rows(wb.worksheets[0]).slice(2), [
    ['Left', '', 30], ['Center', '', 25], ['Right', '', 20], ['Zoom (typed total)', 4, ''],
    ['SUB-TOTAL', 4, 75], ['TOTAL', 79, ''],
  ]);
});

test('the summary averages each month over the meetings that took place', async () => {
  const wb = await load([weekend, midweek('2026-10-28', 90), midweek('2026-10-21', 86)]);
  const sum = rows(wb.getWorksheet('SUMMARY (AVERAGE)'));
  assert.deepEqual(sum.slice(0, 4), [
    ['Date', 'Meeting', 'Zoom'], ['2026-11-01', 'Weekend', 1], ['2026-10-28', 'Midweek', 4], ['2026-10-21', 'Midweek', 4],
  ]);
  const ws = wb.getWorksheet('SUMMARY (AVERAGE)');
  const avg = [];
  ws.eachRow((r) => { if (String(r.getCell(1).value).startsWith('Average')) avg.push([1, 2, 3, 4, 5].map((c) => r.getCell(c).value)); });
  assert.deepEqual(avg, [
    ['Average, midweek, October 2026', '2 meetings', 4, 88, 92],
    ['Average, weekend, November 2026', '1 meeting', 1, 4, 5],
  ]);
  assert.ok(sum.some((r) => r[0] === 'Weeks with no meeting (assemblies, conventions) are left out of the averages.'));
});

test('a name that looks like a formula is written as plain text', async () => {
  const hostile = { ...weekend, people: [{ id: 'p1', name: '=HYPERLINK("x")', group: 'Publishers', size: 1 }], marks: { p1: { where: 'kh', n: 1 } } };
  const cell = (await load([hostile])).worksheets[0].getCell('A3');
  assert.equal(cell.value, '=HYPERLINK("x")');
  assert.equal(cell.formula, undefined);
});

test('two meetings on the same day and type get distinct sheet names', async () => {
  const wb = await load([weekend, { ...weekend }]);
  assert.deepEqual(wb.worksheets.map((w) => w.name).slice(0, 2), ['WEEKEND MEETING (Nov 01)', 'WEEKEND MEETING (Nov 01) (2)']);
});
