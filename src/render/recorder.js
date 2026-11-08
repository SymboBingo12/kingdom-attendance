'use strict';

// Makes the attendance video: draws every frame of /slide in a hidden 1920×1080 window,
// captures it, and pipes the raw frames to ffmpeg for an H.264 MP4 (the format M³ recommends).
// Frame by frame rather than screen recording, so every frame is exact whatever the PC is doing.

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { DURATION, FPS, SETTLED } = require('../../web/shared/timeline');

const W = 1920;
const H = 1080;
const UNCHANGED_MS = 50; // a frame with no paint by then looks the same as the one before (the held total)

// In the installed app ffmpeg is unpacked next to app.asar (see build.asarUnpack).
function ffmpegBinary() {
  return require('ffmpeg-static').replace('app.asar', 'app.asar.unpacked');
}

function startFfmpeg(mp4, bin) {
  const args = [
    '-y', '-loglevel', 'error',
    '-f', 'rawvideo', '-pix_fmt', 'bgra', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    mp4,
  ];
  const ff = spawn(bin, args, { stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true });
  let err = '';
  ff.stderr.on('data', (d) => { err += d; });
  const done = new Promise((resolve, reject) => {
    ff.on('error', reject);
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg stopped (${code}): ${err.trim().slice(0, 300)}`))));
  });
  return { ff, done };
}

// Queues a frame for ffmpeg, waiting only when a few frames are already queued, so encoding
// runs while the next frames are drawn. A broken pipe surfaces through ffmpeg's exit instead.
const QUEUE_BYTES = 8 * W * H * 4;
const write = (stream, buf) => new Promise((resolve) => {
  stream.write(buf);
  if (stream.writableLength < QUEUE_BYTES) resolve();
  else stream.once('drain', resolve);
});

async function renderAttendance({ slideUrl, outDir, fileBase, ffmpegPath = ffmpegBinary(), onProgress = () => {} }) {
  const { BrowserWindow } = require('electron');
  fs.mkdirSync(outDir, { recursive: true });
  const mp4 = path.join(outDir, `${fileBase}.mp4`);
  const png = path.join(outDir, `${fileBase}.png`);
  const tmp = path.join(outDir, `${fileBase}.part.mp4`);

  const win = new BrowserWindow({
    width: W, height: H, useContentSize: true, show: false, frame: false, focusable: false, skipTaskbar: true,
    webPreferences: { offscreen: true, backgroundThrottling: false },
  });
  // Windows shrinks a new window to fit the screen (a 1920×1080 screen at 125 % counts as 1536×864);
  // setting the size again afterwards keeps the full 1920×1080, so frames need no resizing.
  win.setContentSize(W, H);
  let ffmpeg = null;
  try {
    await win.loadURL(slideUrl);
    await win.webContents.executeJavaScript('window.slideReady');
    ffmpeg = startFfmpeg(tmp, ffmpegPath);
    ffmpeg.ff.stdin.on('error', () => {}); // reported by ffmpeg.done

    // Offscreen windows hand over every painted frame; a frame that changed nothing paints nothing,
    // so after a short wait the previous image is the right one.
    const wc = win.webContents;
    wc.setFrameRate(60);
    let latest = await wc.capturePage();
    let waiter = null;
    wc.on('paint', (_e, _dirty, image) => {
      latest = image;
      if (waiter) { const w = waiter; waiter = null; w(); }
    });
    const nextPaint = () => new Promise((resolve) => {
      waiter = resolve;
      setTimeout(() => { if (waiter === resolve) { waiter = null; resolve(); } }, UNCHANGED_MS);
    });

    const frames = Math.round(DURATION * FPS);
    const prof = { start: Date.now(), draw: 0, paint: 0, write: 0, resized: 0 };
    let last = null;
    const settleAt = Number(await wc.executeJavaScript('window.settledAt()')) || SETTLED; // later when there is a visitors slide
    let settled = null; // once nothing moves (the held total), the same frame is written again
    for (let i = 0; i <= frames; i++) {
      if (settled) {
        await write(ffmpeg.ff.stdin, settled);
        onProgress((i + 1) / (frames + 1));
        continue;
      }
      let t0 = Date.now();
      const painted = nextPaint();
      await wc.executeJavaScript(`window.drawAt(${i / FPS})`);
      prof.draw += Date.now() - t0; t0 = Date.now();
      await painted;
      prof.paint += Date.now() - t0; t0 = Date.now();
      let img = latest;
      const size = img.getSize();
      if (size.width !== W || size.height !== H) {
        // Display scaling can round the paint up by a pixel or two: trim that; only resize if it's really off.
        const close = size.width >= W && size.height >= H && size.width - W <= 4 && size.height - H <= 4;
        img = close ? img.crop({ x: 0, y: 0, width: W, height: H }) : img.resize({ width: W, height: H, quality: 'best' });
        prof.resized++;
      }
      last = img;
      const bitmap = img.toBitmap();
      // Settle one frame late, so the first fully settled frame has really been painted.
      if ((i - 1) / FPS >= settleAt) settled = bitmap;
      await write(ffmpeg.ff.stdin, bitmap);
      prof.write += Date.now() - t0;
      onProgress((i + 1) / (frames + 1));
    }
    ffmpeg.ff.stdin.end();
    await ffmpeg.done;
    if (process.env.ATT_PROFILE) console.log('[render]', JSON.stringify({ ...prof, total: Date.now() - prof.start, painted: latest.getSize(), win: win.getContentSize() }));
    fs.renameSync(tmp, mp4);
    fs.writeFileSync(png, last.toPNG());
    return { mp4, png };
  } catch (err) {
    if (ffmpeg) ffmpeg.ff.kill();
    fs.rmSync(tmp, { force: true });
    throw err;
  } finally {
    win.destroy();
  }
}

module.exports = { renderAttendance, ffmpegBinary };
