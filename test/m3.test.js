'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { m3TargetDir, deliverVideo } = require('../src/core/m3');

const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
const NAME = 'Attendance 2026-11-01 Weekend.mp4';

function setup() {
  const src = tmp('att-src-');
  const mp4 = path.join(src, NAME);
  fs.writeFileSync(mp4, 'video-bytes');
  return { mp4, shared: tmp('att-m3-'), desktop: tmp('att-desk-') };
}

test('the M³ folder for a meeting is its date subfolder', () => {
  assert.equal(m3TargetDir('C:\\M3', '2026-11-01'), path.join('C:\\M3', '2026-11-01'));
});

test('the video goes into an existing date folder', async () => {
  const s = setup();
  fs.mkdirSync(path.join(s.shared, '2026-11-01'));
  const out = await deliverVideo({ mp4: s.mp4, sharedFolder: s.shared, dateKey: '2026-11-01', desktopDir: s.desktop });
  assert.equal(out.savedTo, path.join(s.shared, '2026-11-01', NAME));
  assert.equal(out.fallback, false);
  assert.equal(fs.readFileSync(out.savedTo, 'utf8'), 'video-bytes');
  assert.ok(fs.existsSync(s.mp4), 'the original stays (copied, not moved)');
});

test('a missing date folder is created', async () => {
  const s = setup();
  const out = await deliverVideo({ mp4: s.mp4, sharedFolder: s.shared, dateKey: '2026-11-01', desktopDir: s.desktop });
  assert.equal(out.fallback, false);
  assert.ok(fs.existsSync(path.join(s.shared, '2026-11-01', NAME)));
});

test('making the video again replaces the old file', async () => {
  const s = setup();
  await deliverVideo({ mp4: s.mp4, sharedFolder: s.shared, dateKey: '2026-11-01', desktopDir: s.desktop });
  fs.writeFileSync(s.mp4, 'new-bytes');
  const out = await deliverVideo({ mp4: s.mp4, sharedFolder: s.shared, dateKey: '2026-11-01', desktopDir: s.desktop });
  assert.equal(fs.readFileSync(out.savedTo, 'utf8'), 'new-bytes');
});

test('no M³ folder set: saved to the Desktop', async () => {
  const s = setup();
  const out = await deliverVideo({ mp4: s.mp4, sharedFolder: '', dateKey: '2026-11-01', desktopDir: s.desktop });
  assert.equal(out.savedTo, path.join(s.desktop, NAME));
  assert.equal(out.fallback, true);
  assert.equal(out.reason, 'M³ folder not set');
});

test('an M³ folder that no longer exists: saved to the Desktop', async () => {
  const s = setup();
  const out = await deliverVideo({ mp4: s.mp4, sharedFolder: path.join(s.shared, 'gone'), dateKey: '2026-11-01', desktopDir: s.desktop });
  assert.equal(out.fallback, true);
  assert.equal(out.reason, 'M³ folder not found');
  assert.ok(fs.existsSync(path.join(s.desktop, NAME)));
});

test('an M³ folder that cannot be written: saved to the Desktop with the reason', async () => {
  const s = setup();
  fs.writeFileSync(path.join(s.shared, '2026-11-01'), 'a file where the folder should be');
  const out = await deliverVideo({ mp4: s.mp4, sharedFolder: s.shared, dateKey: '2026-11-01', desktopDir: s.desktop });
  assert.equal(out.fallback, true);
  assert.match(out.reason, /^Could not write to M³ folder/);
  assert.ok(fs.existsSync(path.join(s.desktop, NAME)));
});
