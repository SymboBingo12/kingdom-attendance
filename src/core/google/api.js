'use strict';

// The few Google Drive and Sheets calls the sync needs. Plain fetch; the sign-in token comes from getAccessToken.

const DRIVE = 'https://www.googleapis.com/drive/v3';
const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';

class GoogleError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.code = 'GOOGLE';
  }
}

const rgb = (hex) => ({ red: parseInt(hex.slice(1, 3), 16) / 255, green: parseInt(hex.slice(3, 5), 16) / 255, blue: parseInt(hex.slice(5, 7), 16) / 255 });

// The layout's style notes as Sheets requests (see layout.js: { r0, r1, c0, c1, bg, color, bold, size, fmt, h } and { merge }).
function formatRequests(sheetId, ops, widths) {
  const out = [
    { unmergeCells: { range: { sheetId } } },
    { repeatCell: { range: { sheetId }, cell: { userEnteredFormat: {} }, fields: 'userEnteredFormat' } },
    { updateSheetProperties: { properties: { sheetId, gridProperties: { hideGridlines: true } }, fields: 'gridProperties.hideGridlines' } },
    ...(widths || []).map((pixelSize, i) => ({ updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 }, properties: { pixelSize }, fields: 'pixelSize' } })),
  ];
  for (const o of ops || []) {
    if (o.merge) { out.push({ mergeCells: { range: { sheetId, startRowIndex: o.merge[0], endRowIndex: o.merge[1], startColumnIndex: o.merge[2], endColumnIndex: o.merge[3] }, mergeType: 'MERGE_ALL' } }); continue; }
    const f = {};
    const text = {};
    if (o.bg) f.backgroundColor = rgb(o.bg);
    if (o.color) text.foregroundColor = rgb(o.color);
    if (o.bold !== undefined) text.bold = o.bold;
    if (o.size) text.fontSize = o.size;
    if (Object.keys(text).length) f.textFormat = text;
    if (o.fmt) f.numberFormat = { type: o.fmtType || 'NUMBER', pattern: o.fmt };
    if (o.h) f.horizontalAlignment = o.h;
    const fields = [o.bg && 'backgroundColor', Object.keys(text).map((k) => `textFormat.${k}`).join(','), o.fmt && 'numberFormat', o.h && 'horizontalAlignment'].filter(Boolean).join(',');
    out.push({ repeatCell: { range: { sheetId, startRowIndex: o.r0, endRowIndex: o.r1, startColumnIndex: o.c0, endColumnIndex: o.c1 }, cell: { userEnteredFormat: f }, fields } });
  }
  return out;
}

const quote = (title) => `'${String(title).replace(/'/g, "''")}'`;

function createGoogleApi({ fetch: doFetch = fetch, getAccessToken }) {
  async function call(method, url, body) {
    let res;
    try {
      res = await doFetch(url, {
        method,
        headers: { Authorization: `Bearer ${await getAccessToken()}`, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (err) {
      if (err instanceof GoogleError) throw err;
      throw new GoogleError(0, 'No internet connection to Google.');
    }
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    if (!res.ok) throw new GoogleError(res.status, (data && data.error && (data.error.message || data.error)) || `Google answered ${res.status}`);
    return data || {};
  }

  const sheetsOf = async (id) => (await call('GET', `${SHEETS}/${id}?fields=sheets.properties(sheetId,title)`)).sheets.map((s) => s.properties);

  const writeRows = async (id, title, rows) => {
    await call('POST', `${SHEETS}/${id}/values/${encodeURIComponent(quote(title))}:clear`, {});
    await call('PUT', `${SHEETS}/${id}/values/${encodeURIComponent(`${quote(title)}!A1`)}?valueInputOption=USER_ENTERED`, { values: rows });
  };

  return {
    // Spreadsheets this app created earlier (with drive.file the app sees only its own files), by exact name.
    async findByName(name) {
      const q = `name = '${String(name).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`;
      const res = await call('GET', `${DRIVE}/files?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc&pageSize=10`);
      return res.files || [];
    },
    async createSpreadsheet(title, tabs) {
      const res = await call('POST', SHEETS, { properties: { title }, sheets: tabs.map((t) => ({ properties: { title: t } })) });
      return res.spreadsheetId;
    },
    sheetsOf,
    async ensureSheet(id, title) {
      const found = (await sheetsOf(id)).find((s) => s.title === title);
      if (found) return found.sheetId;
      const res = await call('POST', `${SHEETS}/${id}:batchUpdate`, { requests: [{ addSheet: { properties: { title } } }] });
      return res.replies[0].addSheet.properties.sheetId;
    },
    async renameSheet(id, sheetId, title) {
      await call('POST', `${SHEETS}/${id}:batchUpdate`, { requests: [{ updateSheetProperties: { properties: { sheetId, title }, fields: 'title' } }] });
    },
    async readCell(id, title, cell = 'A1') {
      const res = await call('GET', `${SHEETS}/${id}/values/${encodeURIComponent(`${quote(title)}!${cell}`)}`);
      return (res.values && res.values[0] && res.values[0][0]) || '';
    },
    // Replaces everything on a tab with these rows.
    writeRows,
    // The same, and then styles the tab: bands, fonts, merged cells and column widths.
    async writeSheet(id, title, { rows, ops, widths }) {
      const sheetId = await this.ensureSheet(id, title);
      await writeRows(id, title, rows);
      await call('POST', `${SHEETS}/${id}:batchUpdate`, { requests: formatRequests(sheetId, ops, widths) });
    },
  };
}

module.exports = { createGoogleApi, GoogleError };
