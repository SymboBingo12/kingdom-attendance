'use strict';

// Signing in to Google from the desktop app: the browser opens Google's page, Google sends the browser back to a
// one-use address on this computer (127.0.0.1) with a code, and the code is traded for a token. PKCE keeps the code useless to anyone else.
// Only the narrow drive.file permission is asked for: the app can reach the spreadsheets it created, nothing else in the Drive.

const crypto = require('node:crypto');
const http = require('node:http');
const { GoogleError } = require('./api');

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const SCOPES = ['https://www.googleapis.com/auth/drive.file', 'openid', 'email'];
const WAIT_MS = 5 * 60 * 1000;

const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const emailOf = (idToken) => {
  try { return JSON.parse(Buffer.from(String(idToken).split('.')[1], 'base64url').toString('utf8')).email || ''; } catch { return ''; }
};
const PAGE = (msg) => `<!doctype html><meta charset="utf-8"><title>Kingdom Hall Attendance</title><body style="font:18px system-ui;text-align:center;margin-top:20vh">${msg}</body>`;

function createAuth({ fetch: doFetch = fetch, clientId, clientSecret, load, save, now = () => Date.now() }) {
  const configured = () => !!clientId && !clientId.startsWith('YOUR_CLIENT_ID');

  async function token(params) {
    let res;
    try {
      res = await doFetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...params }).toString() });
    } catch {
      throw new GoogleError(0, 'No internet connection to Google.');
    }
    const data = await res.json().catch(() => ({}));
    if (data.error === 'invalid_client') throw new GoogleError(400, "Google doesn't recognise this app's client ID or secret (invalid_client). This build has the wrong Google credentials.");
    if (!res.ok) throw new GoogleError(data.error === 'invalid_grant' ? 401 : res.status, data.error_description || data.error || 'Google refused the sign-in.');
    return data;
  }

  // Opens the loopback listener and returns the Google page to send the user to; done resolves with the account's email.
  async function begin() {
    const verifier = b64url(crypto.randomBytes(32));
    const state = b64url(crypto.randomBytes(16));
    const server = http.createServer();
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const redirect = `http://127.0.0.1:${server.address().port}`;
    const url = `${AUTH_URL}?${new URLSearchParams({
      client_id: clientId, redirect_uri: redirect, response_type: 'code', scope: SCOPES.join(' '), state,
      code_challenge: b64url(crypto.createHash('sha256').update(verifier).digest()), code_challenge_method: 'S256', access_type: 'offline', prompt: 'consent',
    })}`;

    const done = new Promise((resolve, reject) => {
      const timer = setTimeout(() => { server.close(); reject(new GoogleError(0, 'Sign-in took too long. Try Connect again.')); }, WAIT_MS);
      timer.unref();
      server.on('request', async (req, res) => {
        const q = new URL(req.url, redirect).searchParams;
        if (q.get('state') !== state || (!q.get('code') && !q.get('error'))) { res.writeHead(404); return res.end(); }
        clearTimeout(timer);
        const finish = (html) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(PAGE(html)); server.close(); };
        if (q.get('error')) { finish('Sign-in was cancelled. You can close this tab.'); return reject(new GoogleError(0, 'Sign-in was cancelled.')); }
        try {
          const t = await token({ code: q.get('code'), redirect_uri: redirect, grant_type: 'authorization_code', code_verifier: verifier });
          save({ tokens: { access_token: t.access_token, refresh_token: t.refresh_token, expires_at: now() + (t.expires_in || 3600) * 1000 } });
          finish('Connected. You can close this tab and go back to Kingdom Hall Attendance.');
          resolve({ email: emailOf(t.id_token) });
        } catch (err) {
          finish('Google could not finish the sign-in. You can close this tab and try again.');
          reject(err);
        }
      });
    });
    done.catch(() => {});
    return { url, done };
  }

  async function accessToken() {
    const { tokens } = load();
    if (!tokens || !tokens.refresh_token) throw new GoogleError(401, 'Not connected to Google.');
    if (tokens.expires_at > now() + 60 * 1000) return tokens.access_token;
    const t = await token({ refresh_token: tokens.refresh_token, grant_type: 'refresh_token' });
    const next = { ...tokens, access_token: t.access_token, expires_at: now() + (t.expires_in || 3600) * 1000 };
    save({ tokens: next });
    return next.access_token;
  }

  async function revoke() {
    const { tokens } = load();
    if (!tokens) return;
    try { await doFetch(REVOKE_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `token=${encodeURIComponent(tokens.refresh_token || tokens.access_token)}` }); } catch { /* offline: the token is dropped here anyway */ }
  }

  return { configured, begin, accessToken, revoke };
}

module.exports = { createAuth, SCOPES };
