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
  let hall = (m.lanes ? m.lanes.left + m.lanes.center + m.lanes.right : 0) + (m.unnamed || 0);
  let zoom = m.zoom || 0;
  for (const { where, n } of Object.values(m.marks || {})) { if (where === 'kh') hall += n; else zoom += n; }
  return { hall, zoom, total: hall + zoom };
};

// The Weekend Meeting / Midweek Meeting tab: every name with Zoom or Kingdom Hall, then the totals.
function meetingRows(m, congregation = '') {
  const t = totalsOf(m);
  const rows = [[HEADING[m.type] || HEADING.weekend], [safe(congregation)], [m.date], ['PUBLISHER', 'ZOOM', 'KINGDOM HALL']];
  const people = m.people || [];
  for (const g of groupOrder([...new Set(people.map((p) => p.group))])) {
    rows.push([safe(g.toUpperCase())]);
    for (const p of people.filter((x) => x.group === g)) {
      const mark = (m.marks || {})[p.id];
      rows.push([safe(p.name), mark && mark.where === 'zoom' ? mark.n : '', mark && mark.where === 'kh' ? mark.n : '']);
    }
  }
  if (!people.length) for (const l of ['left', 'center', 'right']) rows.push([l[0].toUpperCase() + l.slice(1), '', (m.lanes || {})[l] || '']);
  else if (m.zoom) rows.push(['Zoom (typed total)', m.zoom, '']);
  if (m.unnamed) rows.push(['Unnamed visitors', '', m.unnamed]);
  rows.push(['SUB-TOTAL', t.zoom, t.hall], ['TOTAL', t.total, '']);
  return rows;
}

const inYear = (history, start) => history.filter((m) => serviceYearOf(m.date) === start).sort((a, b) => a.date.localeCompare(b.date));

// Service Year Record: a row per meeting date (Zoom, In-Person, Total for midweek, then weekend), then monthly averages.
function recordRows(history, start) {
  const list = inYear(history, start);
  const rows = [[`SERVICE YEAR ${yearLabel(start)} · ATTENDANCE RECORD`], ['DATE', 'MIDWEEK MEETING', '', '', 'WEEKEND MEETING', '', ''], ['', 'Zoom', 'In-Person', 'TOTAL', 'Zoom', 'In-Person', 'TOTAL']];
  for (const m of list) {
    const t = totalsOf(m);
    rows.push(m.type === 'midweek' ? [m.date, t.zoom, t.hall, t.total, '', '', ''] : [m.date, '', '', '', t.zoom, t.hall, t.total]);
  }
  rows.push([], ['MONTHLY AVERAGE', 'MIDWEEK MEETING', '', '', 'WEEKEND MEETING', '', ''], ['', 'Zoom', 'In-Person', 'TOTAL', 'Zoom', 'In-Person', 'TOTAL']);
  const avg = (ms, key) => (ms.length ? Math.round(ms.reduce((s, m) => s + totalsOf(m)[key], 0) / ms.length) : '');
  MONTHS.forEach((name, i) => {
    const month = ((8 + i) % 12) + 1;
    const of = (type) => list.filter((m) => m.type === type && Number(m.date.slice(5, 7)) === month);
    const [mid, wk] = [of('midweek'), of('weekend')];
    rows.push([name, avg(mid, 'zoom'), avg(mid, 'hall'), avg(mid, 'total'), avg(wk, 'zoom'), avg(wk, 'hall'), avg(wk, 'total')]);
  });
  return rows;
}

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

const readMeRows = (congregation) => [[], ['', `Log for Attendance | ${congregation}`], [], ['', 'Kept up to date by Kingdom Attendance after every finalized meeting.'],
  ['', 'Each service year (September 1 – August 31) gets fresh Weekend Meeting and Midweek Meeting tabs; the old ones are kept, renamed with their year.']];

module.exports = { TAB, serviceYearOf, yearLabel, recordTab, meetingRows, recordRows, logRows, readMeRows, totalsOf, colLetter };
