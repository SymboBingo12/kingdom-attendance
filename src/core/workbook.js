'use strict';

// The circuit overseer's workbook, laid out like the congregation's attendance sheet: one sheet per meeting
// (everyone by name under ZOOM or KINGDOM HALL, then the totals) and a SUMMARY (AVERAGE) sheet with monthly
// averages over the meetings that took place. Values only: no formulas, so names can never run as one.

const ExcelJS = require('exceljs');
const { totals, upgrade } = require('./meeting');

const NOTE = 'Weeks with no meeting (assemblies, conventions) are left out of the averages.';
const day = (date) => new Date(`${date}T12:00:00`);
const longDate = (date) => day(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
const shortDate = (date) => day(date).toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
const monthName = (date) => day(date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
const typeLabel = (type) => (type === 'weekend' ? 'Weekend' : 'Midweek');

function meetingSheet(wb, name, m, congregation) {
  const ws = wb.addWorksheet(name);
  ws.getColumn(1).width = 34;
  ws.getColumn(2).width = 12;
  ws.getColumn(3).width = 16;
  const bold = (row) => { row.font = { bold: true }; };
  const t = totals(m);

  bold(ws.addRow([`${(congregation || 'Congregation').toUpperCase()} (${longDate(m.date)})`]));
  bold(ws.addRow(['PUBLISHER', 'ZOOM', 'KINGDOM HALL']));

  const people = Array.isArray(m.people) ? m.people : [];
  let group = null;
  for (const p of people) {
    if (group !== null && p.group !== group) {
      ws.addRow([]);
      bold(ws.addRow([p.group]));
    }
    group = p.group;
    const mark = m.marks[p.id];
    ws.addRow([p.name, mark && mark.where === 'zoom' ? mark.n : null, mark && mark.where === 'kh' ? mark.n : null]);
  }
  if (people.length) {
    ws.addRow([]);
    ws.addRow(['Unnamed visitors', null, m.unnamed || null]);
  }

  const lanesUsed = m.lanes.left + m.lanes.center + m.lanes.right > 0;
  if (lanesUsed || !people.length) {
    ws.addRow(['Left', null, m.lanes.left]);
    ws.addRow(['Center', null, m.lanes.center]);
    ws.addRow(['Right', null, m.lanes.right]);
  }
  if (m.zoom || !people.length) ws.addRow(['Zoom (typed total)', m.zoom, null]);

  bold(ws.addRow(['SUB-TOTAL', t.zoom, t.hall]));
  bold(ws.addRow(['TOTAL', t.total]));
}

function summarySheet(wb, meetings) {
  const ws = wb.addWorksheet('SUMMARY (AVERAGE)');
  ws.getColumn(1).width = 36;
  [2, 3, 4, 5].forEach((c) => { ws.getColumn(c).width = 13; });
  ws.addRow(['Date', 'Meeting', 'Zoom', 'In-Person', 'Total']).font = { bold: true };
  for (const m of meetings) {
    const t = totals(m);
    ws.addRow([m.date, typeLabel(m.type), t.zoom, t.hall, t.total]);
  }
  ws.addRow([]);

  for (const type of ['midweek', 'weekend']) {
    const months = new Map();
    for (const m of meetings.filter((x) => x.type === type)) {
      const key = m.date.slice(0, 7);
      if (!months.has(key)) months.set(key, []);
      months.get(key).push(m);
    }
    for (const key of [...months.keys()].sort()) {
      const ms = months.get(key);
      const avg = (pick) => Math.round(ms.reduce((s, m) => s + pick(totals(m)), 0) / ms.length);
      ws.addRow([`Average, ${type}, ${monthName(ms[0].date)}`, `${ms.length} meeting${ms.length === 1 ? '' : 's'}`,
        avg((t) => t.zoom), avg((t) => t.hall), avg((t) => t.total)]).font = { bold: true };
    }
  }
  ws.addRow([]);
  ws.addRow([NOTE]);
}

async function buildOverseerWorkbook({ history, congregation }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Kingdom Hall Attendance';
  const meetings = history.map(upgrade);
  const used = new Set();
  for (const m of meetings) {
    const base = `${m.type === 'weekend' ? 'WEEKEND' : 'MIDWEEK'} MEETING (${shortDate(m.date)})`.slice(0, 31);
    let name = base;
    for (let i = 2; used.has(name); i++) name = `${base.slice(0, 26)} (${i})`;
    used.add(name);
    meetingSheet(wb, name, m, congregation);
  }
  summarySheet(wb, meetings);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

module.exports = { buildOverseerWorkbook };
