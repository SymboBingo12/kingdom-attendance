'use strict';

// The local web server phones and the OBS dock talk to. Same shape as Stage Timer's server
// (PIN away from the AV PC, live updates over Server-Sent Events), written fresh for this app.

const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const QRCode = require('qrcode');
const { appearanceOf } = require('./settings');

const PAGES = {
  '/count': 'count.html',
  '/dock': 'dock.html',
  '/zoom': 'dock.html',
  '/slide': 'slide.html',
  '/history': 'history.html',
};
const SCRIPTS = ['/count.js', '/dock.js', '/slide.js', '/history.js'];
const STATIC_DIRS = ['steward', 'shared'];
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};
const STATUS = { BAD_LANE: 400, BAD_DELTA: 400, BAD_ZOOM: 400, BAD_TYPE: 400, BAD_BODY: 400, NOT_FINAL: 409, LOCKED: 409, BUSY: 409 };
const MAX_BODY = 10 * 1024;
const PIN_TRIES = 5;
const PIN_WINDOW_MS = 60 * 1000;

const isLoopback = (addr) => addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// The address phones on the hall Wi-Fi can reach. 169.254.x.x is what Windows gives an adapter
// that has no network, so it is never the right one.
function pickLanAddress(interfaces) {
  for (const list of Object.values(interfaces)) {
    for (const a of list || []) {
      if (a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.')) return a.address;
    }
  }
  return null;
}

const lanAddress = () => pickLanAddress(os.networkInterfaces());

// The links people are given. They use the IP address because many Android phones can't open
// ".local" names; the short name is offered as well for phones and PCs that can.
function buildUrls({ port, ip, hostname }) {
  const suffix = port === 80 ? '' : `:${port}`;
  const host = ip || hostname || 'localhost';
  return {
    count: `http://${host}${suffix}/count`,
    zoom: `http://${host}${suffix}/zoom`,
    dock: `http://localhost${suffix}/dock`,
    named: hostname ? `http://${hostname}${suffix}/count` : null,
  };
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('Request too large.'), { code: 'BAD_BODY' }));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      if (!text) return resolve({});
      try {
        const body = JSON.parse(text);
        resolve(body && typeof body === 'object' ? body : {});
      } catch {
        reject(Object.assign(new Error('The request was not valid JSON.'), { code: 'BAD_BODY' }));
      }
    });
    req.on('error', reject);
  });
}

function createServer(service, { settings, webDir, mdns = true }) {
  const cfg = () => (typeof settings === 'function' ? settings() : settings);
  const failures = new Map(); // ip -> timestamps of wrong PINs
  const streams = new Set();
  let port = null;
  let announcer = null;

  const pinRequired = (req) => !(cfg().localNoPin && isLoopback(req.socket.remoteAddress));

  function authorised(req, res) {
    if (!pinRequired(req)) return true;
    const ip = req.socket.remoteAddress;
    const recent = (failures.get(ip) || []).filter((t) => Date.now() - t < PIN_WINDOW_MS);
    if (recent.length >= PIN_TRIES) {
      send(res, 429, { error: 'Too many wrong PINs. Wait a minute.' });
      return false;
    }
    const pin = req.headers['x-pin'] || new URL(req.url, 'http://x').searchParams.get('pin') || '';
    if (safeEqual(pin, cfg().pin)) {
      failures.delete(ip);
      return true;
    }
    if (pin) failures.set(ip, [...recent, Date.now()]);
    send(res, 401, { error: pin ? 'Wrong PIN' : 'PIN needed' });
    return false;
  }

  const urls = () => buildUrls({ port, ip: lanAddress(), hostname: announcer ? announcer.hostname : null });

  function serveFile(res, file) {
    const resolved = path.resolve(webDir, file);
    if (!resolved.startsWith(path.resolve(webDir) + path.sep)) return send(res, 404, { error: 'Not found' });
    fs.readFile(resolved, (err, data) => {
      if (err) return send(res, 404, { error: 'Not found' });
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(resolved)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(data);
    });
  }

  function openStream(req, res) {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    const push = (state) => res.write(`data: ${JSON.stringify(state)}\n\n`);
    const keepalive = setInterval(() => res.write(':keepalive\n\n'), 15000);
    push(service.getState());
    service.on('change', push);
    const stream = { res, close: () => { clearInterval(keepalive); service.off('change', push); } };
    streams.add(stream);
    req.on('close', () => { stream.close(); streams.delete(stream); });
  }

  const actions = {
    '/api/tap': (b) => service.tap(b.lane, b.delta, typeof b.tapId === 'string' ? b.tapId.slice(0, 64) : undefined),
    '/api/zoom': (b) => service.setZoom(b.value),
    '/api/finalize': () => service.finalize(),
    '/api/unlock': () => service.unlock(),
    '/api/new': (b) => service.newMeeting(b.type),
    '/api/type': (b) => service.setType(b.type),
    '/api/rerender': () => service.rerender(),
  };

  async function handle(req, res) {
    const u = new URL(req.url, 'http://x');
    const p = u.pathname;

    if (req.method === 'GET' && p === '/') {
      res.writeHead(302, { Location: '/count' });
      return res.end();
    }
    if (req.method === 'GET' && PAGES[p]) return serveFile(res, PAGES[p]);
    if (req.method === 'GET' && SCRIPTS.includes(p)) return serveFile(res, p.slice(1));
    const dir = p.split('/')[1];
    if (req.method === 'GET' && STATIC_DIRS.includes(dir)) return serveFile(res, p.slice(1));

    if (req.method === 'GET' && p === '/api/whoami') {
      return send(res, 200, { pinRequired: pinRequired(req), local: isLoopback(req.socket.remoteAddress) });
    }
    // Colours only, so pages can look right before the PIN is entered.
    if (req.method === 'GET' && p === '/api/appearance') return send(res, 200, { appearance: appearanceOf(cfg()) });
    if (!p.startsWith('/api/')) return send(res, 404, { error: 'Not found' });
    if (!authorised(req, res)) return;

    if (req.method === 'GET') {
      if (p === '/api/state') return send(res, 200, service.getState());
      if (p === '/api/events') return openStream(req, res);
      if (p === '/api/history') return send(res, 200, service.store.listHistory());
      if (p === '/api/history.csv') {
        res.writeHead(200, {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="attendance-history.csv"',
          'Cache-Control': 'no-store',
        });
        return res.end(service.store.historyCsv());
      }
      if (p === '/api/connect') {
        if (!isLoopback(req.socket.remoteAddress)) return send(res, 403, { error: 'Only on the AV computer.' });
        const links = urls();
        const qr = await QRCode.toDataURL(links.count, { margin: 1, width: 320 });
        return send(res, 200, { ...links, pin: cfg().pin, qr });
      }
      return send(res, 404, { error: 'Not found' });
    }

    if (req.method === 'POST' && actions[p]) {
      const body = await readBody(req);
      return send(res, 200, actions[p](body));
    }
    return send(res, 404, { error: 'Not found' });
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch((err) => {
      const status = STATUS[err.code];
      if (status) return send(res, status, { error: err.message });
      console.error('[attendance] request failed:', err);
      if (!res.headersSent) send(res, 500, { error: 'Something went wrong on the AV computer.' });
    });
  });

  function tryListen(p) {
    return new Promise((resolve, reject) => {
      const onError = (err) => { server.off('listening', onListening); reject(err); };
      const onListening = () => { server.off('error', onError); resolve(server.address().port); };
      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(p, '0.0.0.0');
    });
  }

  return {
    urls,
    get port() { return port; },
    async listen() {
      const wanted = cfg().port;
      try {
        port = await tryListen(wanted);
      } catch (err) {
        if (err.code !== 'EADDRINUSE' || wanted === 0) throw err;
        port = await tryListen(wanted + 1);
      }
      if (mdns) {
        const { advertise } = require('./mdns');
        announcer = advertise({ hostname: cfg().hostname, port, getAddress: lanAddress, onError: (e) => console.warn('[attendance] mDNS:', e.message) });
      }
      return { port };
    },
    async close() {
      for (const s of streams) { s.close(); s.res.end(); }
      streams.clear();
      if (announcer) await announcer.stop();
      await new Promise((resolve) => server.close(() => resolve()));
    },
  };
}

module.exports = { createServer, isLoopback, pickLanAddress, buildUrls };
