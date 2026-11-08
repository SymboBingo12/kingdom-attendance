'use strict';

// What goes into the two Google spreadsheets, as plain rows of cells. Pure functions, no network.
// The layouts follow the congregation's own sheets: a Weekend / Midweek tab per meeting type, a Service Year
// Record, and a Log with one row per person and one column per meeting date.

const GROUPS = ['Publishers', 'Unbaptized publishers'];
const INVITED = 'Invited';
const CATEGORY = { Publishers: 'Publisher', 'Unbaptized publishers': 'Unbaptized publisher', Invited: 'Invited' };
const MONTHS = ['SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER', 'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST'];

const TAB = { weekend: 'Weekend Meeting', midweek: 'Midweek Meeting' };
const HEADING = { weekend: 'PUBLIC TALK AND WATCHTOWER STUDY', midweek: 'LIFE AND MINISTRY' };

// A service year runs from September 1 to August 31; it is named by the year it starts in.
const serviceYearOf = (dateKey) => {
  const [y, m] = String(dateKey).split('-').map(Number);
  return m >= 9 ? y : y - 1;
};
const yearLabel = (start) => `${start}–${start + 1}`;
const recordTab = (start) => `Service Year Record (${yearLabel(start)})`;

// Google runs "=…", "+…", "-…" and "@…" as formulas; a leading apostrophe keeps a name as plain text.
const safe = (v) => (typeof v === 'string' && /^[=+\-@]/.test(v) ? `'${v}` : v);

const colLetter = (n) => { let s = ''; for (let i = n; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s; return s; };

const groupOrder = (groups) => {
  const others = groups.filter((g) => !GROUPS.includes(g) && g !== INVITED);
  return [...GROUPS, ...others, INVITED].filter((g) => groups.includes(g));
};

const totalsOf = (m) => {
  let hall = (m.lanes ? m.lanes.left + m.lanes.center + m.lanes.right : 0) + (m.hall || 0) + (m.unnamed || 0) + (m.khVisitors && m.khVisitors.included === false ? m.khVisitors.n : 0);
  let zoom = m.zoom || 0;
  for (const { where, n } of Object.values(m.marks || {})) { if (where === 'kh') hall += n; else zoom += n; }
  return { hall, zoom, total: hall + zoom };
};

// ---- The Attendance spreadsheet ---------------------------------------------------------------------------
// Both tabs follow the congregation's sample sheet: a narrow empty column A, the content from column B, grey bands,
// totals as formulas. A sheet is { rows, ops, widths }: the cell values, the styling to apply (see api.writeSheet) and
// the column widths in pixels.

const COLOR = { dark: '#666666', band: '#999999', light: '#CCCCCC', pale: '#B7B7B7', white: '#FFFFFF', black: '#000000', blue: '#0000FF', grey: '#444444' };

function builder() {
  const rows = [[]];
  const ops = [];
  return {
    rows,
    ops,
    put: (cells) => { rows.push(['', ...cells]); return rows.length; }, // the 1-based row number
    style: (row, c0, c1, p) => ops.push({ r0: row - 1, r1: row, c0, c1: c1 + 1, ...p }),
    block: (r0, r1, c0, c1, p) => ops.push({ r0: r0 - 1, r1, c0, c1: c1 + 1, ...p }),
    merge: (row, c0, c1) => ops.push({ merge: [row - 1, row, c0, c1 + 1] }),
  };
}

// The Weekend Meeting / Midweek Meeting tab: every name with Zoom or Kingdom Hall, grouped, then the totals.
function meetingSheet(m) {
  const t = builder();
  const title = t.put([HEADING[m.type] || HEADING.weekend]);
  t.merge(title, 1, 3); t.style(title, 1, 3, { bg: COLOR.dark, color: COLOR.white, bold: true, size: 16 });
  const date = t.put([m.date]);
  t.merge(date, 1, 3); t.style(date, 1, 3, { bg: COLOR.band, color: COLOR.grey, size: 10, fmt: 'dddd, mmmm d, yyyy', fmtType: 'DATE', h: 'LEFT' });
  const head = t.put(['PUBLISHER', 'ZOOM', 'KINGDOM HALL']);
  t.style(head, 1, 3, { bg: COLOR.band, color: COLOR.black, bold: true });
  t.style(head, 2, 3, { h: 'CENTER' });
  const first = t.rows.length + 1;
  const bands = [];
  const names = [];
  const people = m.people || [];
  for (const g of groupOrder([...new Set(people.map((p) => p.group))])) {
    if (g !== 'Publishers') { const r = t.put([safe(g === INVITED ? 'INVITED THRU ZOOM & KH' : g.toUpperCase())]); bands.push(r); }
    for (const p of people.filter((x) => x.group === g)) {
      const mark = (m.marks || {})[p.id];
      names.push(t.put([safe(p.name), mark && mark.where === 'zoom' ? mark.n : '', mark && mark.where === 'kh' ? mark.n : '']));
    }
  }
  if (!people.length) for (const l of ['left', 'center', 'right']) names.push(t.put([l[0].toUpperCase() + l.slice(1), '', (m.lanes || {})[l] || '']));
  if (m.hall) names.push(t.put(['Kingdom Hall (overall count)', '', m.hall]));
  if (m.zoom) names.push(t.put(['Zoom (typed total)', m.zoom, '']));
  // Visitors typed as a number: added here, or only noted when the Kingdom Hall count already has them.
  const kv = m.khVisitors || { n: 0, included: null };
  const added = (m.unnamed || 0) + (kv.included === false ? kv.n : 0);
  const note = kv.included === true && kv.n ? ` (${kv.n} already counted above)` : '';
  const visitors = t.put([`KINGDOM HALL VISITORS${note}`, '', added || '']);
  const sub = t.put(['SUB-TOTAL', `=SUM(C${first}:C${visitors})`, `=SUM(D${first}:D${visitors})`]);
  const grand = t.put(['GRAND TOTAL', `=SUM(C${sub}:D${sub})`]);
  // styles, later ones win: numbers, names, group bands, the visitors row, the totals
  t.block(first, visitors, 2, 3, { bold: true, size: 16, fmt: '#,##0', fmtType: 'NUMBER', h: 'CENTER', color: COLOR.black });
  for (const r of names) t.style(r, 1, 1, { bold: true, color: COLOR.blue });
  for (const r of bands) { t.merge(r, 1, 3); t.style(r, 1, 3, { bg: COLOR.band, bold: true, color: COLOR.black, size: 11, h: 'LEFT' }); }
  t.style(visitors, 1, 3, { bg: COLOR.pale });
  t.style(visitors, 1, 1, { bold: true, color: COLOR.white, size: 14, h: 'LEFT' });
  t.style(sub, 1, 3, { bg: COLOR.band, bold: true, color: COLOR.white, size: 16, fmt: '#,##0', fmtType: 'NUMBER' });
  t.style(sub, 2, 3, { h: 'CENTER' });
  t.merge(grand, 2, 3);
  t.style(grand, 1, 3, { bg: COLOR.dark, bold: true, color: COLOR.white, size: 16, fmt: '#,##0', fmtType: 'NUMBER' });
  t.style(grand, 2, 3, { h: 'CENTER' });
  return { rows: t.rows, ops: t.ops, widths: [30, 245, 137, 137] };
}

const meetingRows = (m) => meetingSheet(m).rows;

const inYear = (history, start) => history.filter((m) => serviceYearOf(m.date) === start).sort((a, b) => a.date.localeCompare(b.date));

const pad = (n) => String(n).padStart(2, '0');

// Every Tuesday and Sunday of a month, plus any other day a meeting was actually held (a visit, a holiday).
function meetingDays(year, month, extra) {
  const days = new Set(extra);
  for (let d = 1; d <= new Date(Date.UTC(year, month, 0)).getUTCDate(); d++) {
    const wd = new Date(Date.UTC(year, month - 1, d)).getUTCDay();
    if (wd === 0 || wd === 2) days.add(`${year}-${pad(month)}-${pad(d)}`);
  }
  return [...days].sort();
}

// Service Year Record: one block per month (September to August) with a row for each meeting day,
// the Zoom / In-Person / Total of the midweek and weekend meeting, and an OVERALL TOTAL and AVERAGE of the month.
function recordSheet(history, start) {
  const list = inYear(history, start);
  const t = builder();
  const top = t.put([`SERVICE YEAR ${yearLabel(start)} · ATTENDANCE RECORD`]);
  t.merge(top, 1, 7); t.style(top, 1, 7, { bg: COLOR.dark, color: COLOR.white, bold: true, size: 16 });
  t.put([]);
  const HEAD = ['Zoom', 'In-Person', 'TOTAL'];
  MONTHS.forEach((name, i) => {
    const month = ((8 + i) % 12) + 1;
    const year = month >= 9 ? start : start + 1;
    const inMonth = list.filter((m) => Number(m.date.slice(5, 7)) === month);
    const days = meetingDays(year, month, inMonth.map((m) => m.date));
    const title = t.put(['MONTHLY AVERAGE ATTENDANCE']);
    t.merge(title, 1, 7); t.style(title, 1, 7, { bg: COLOR.light, bold: true, color: COLOR.black, size: 12 });
    const mh = t.put([`${year}-${pad(month)}-01`, 'MIDWEEK MEETING', '', '', 'WEEKEND MEETING', '', '']);
    t.merge(mh, 2, 4); t.merge(mh, 5, 7);
    t.style(mh, 1, 7, { bg: COLOR.light, bold: true, color: COLOR.white, size: 20, h: 'CENTER' });
    t.style(mh, 1, 1, { fmt: 'mmmm yyyy', fmtType: 'DATE', h: 'LEFT' });
    const sh = t.put(['', ...HEAD, ...HEAD]);
    t.style(sh, 1, 7, { bg: COLOR.light, bold: true, color: COLOR.black, size: 14, h: 'CENTER' });
    const a = t.rows.length + 1;
    for (const day of days) {
      const r = t.rows.length + 1;
      const of = (type) => inMonth.find((m) => m.date === day && m.type === type);
      const mid = of('midweek') && totalsOf(of('midweek'));
      const wk = of('weekend') && totalsOf(of('weekend'));
      t.put([day, mid ? mid.zoom : '', mid ? mid.hall : '', `=IF(COUNT(C${r}:D${r})=0,"",SUM(C${r}:D${r}))`, wk ? wk.zoom : '', wk ? wk.hall : '', `=IF(COUNT(F${r}:G${r})=0,"",SUM(F${r}:G${r}))`]);
    }
    const b = t.rows.length;
    t.block(a, b, 1, 7, { bold: true, size: 14, color: COLOR.black, fmt: '#,##0', fmtType: 'NUMBER', h: 'CENTER' });
    t.block(a, b, 1, 1, { fmt: 'ddd, mmm d, yyyy', fmtType: 'DATE', h: 'LEFT' });
    const col = (c) => colLetter(c + 1);
    const total = t.put(['OVERALL TOTAL', ...[2, 3, 4, 5, 6, 7].map((c) => `=SUM(${col(c)}${a}:${col(c)}${b})`)]);
    const average = t.put(['AVERAGE', ...[2, 3, 4, 5, 6, 7].map((c) => `=IFERROR(AVERAGE(${col(c)}${a}:${col(c)}${b}),"")`)]);
    t.style(total, 1, 7, { bg: COLOR.band, bold: true, color: COLOR.white, size: 14, fmt: '#,##0', fmtType: 'NUMBER' });
    t.style(average, 1, 7, { bg: COLOR.band, bold: true, color: COLOR.white, size: 14, fmt: '0.0', fmtType: 'NUMBER' });
    t.style(total, 2, 7, { h: 'CENTER' }); t.style(average, 2, 7, { h: 'CENTER' });
    t.put([]); t.put([]);
  });
  return { rows: t.rows, ops: t.ops, widths: [24, 190, 95, 95, 95, 95, 95, 95] };
}

const recordRows = (history, start) => recordSheet(history, start).rows;

// The Log: a row per person, a column per meeting date; the cell holds how many of them came.
function logRows(history, type, start) {
  const list = inYear(history, start).filter((m) => m.type === type);
  const header = ['NAME', 'CATEGORY', 'MEETINGS ATTENDED', ...list.map((m) => m.date)];
  const title = [`LOG FOR ATTENDANCE – ${TAB[type].toUpperCase()} – SERVICE YEAR ${yearLabel(start)}`];
  const people = new Map();
  list.forEach((m, col) => {
    for (const p of m.people || []) {
      const key = `${p.group}|${p.name}`;
      if (!people.has(key)) people.set(key, { name: p.name, group: p.group, cells: new Array(list.length).fill('') });
      const mark = (m.marks || {})[p.id];
      if (mark) people.get(key).cells[col] = mark.n;
    }
  });
  const rows = [title, header];
  const order = groupOrder([...new Set([...people.values()].map((p) => p.group))]);
  for (const g of order) {
    for (const p of [...people.values()].filter((x) => x.group === g)) {
      const r = rows.length + 1;
      const last = colLetter(3 + list.length);
      rows.push([safe(p.name), CATEGORY[p.group] || safe(p.group), list.length ? `=COUNTIF(D${r}:${last}${r},">0")` : 0, ...p.cells]);
    }
  }
  if (list.some((m) => m.unnamed)) rows.push(['Unnamed visitors', '', '', ...list.map((m) => m.unnamed || '')]);
  return rows;
}

const readMeRows = (congregation) => [[], ['', `Log for Attendance | ${congregation}`], [], ['', 'Kept up to date by Kingdom Hall Attendance after every finalized meeting.'],
  ['', 'Each service year (September 1 – August 31) gets fresh Weekend Meeting and Midweek Meeting tabs; the old ones are kept, renamed with their year.']];

module.exports = { meetingSheet, recordSheet, TAB, serviceYearOf, yearLabel, recordTab, meetingRows, recordRows, logRows, readMeRows, totalsOf, colLetter };
