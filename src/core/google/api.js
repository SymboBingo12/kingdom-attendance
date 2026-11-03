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
    async writeRows(id, title, rows) {
      await call('POST', `${SHEETS}/${id}/values/${encodeURIComponent(quote(title))}:clear`, {});
      await call('PUT', `${SHEETS}/${id}/values/${encodeURIComponent(`${quote(title)}!A1`)}?valueInputOption=USER_ENTERED`, { values: rows });
    },
  };
}

module.exports = { createGoogleApi, GoogleError };
