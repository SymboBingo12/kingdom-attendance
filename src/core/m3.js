'use strict';

// Hands the video to M³. With M³'s "Add media from a shared folder" turned on, M³ adds any file in
// <shared folder>\YYYY-MM-DD\ to that meeting's media list by itself. If that folder isn't usable,
// the video goes to the Desktop so the AV can drag it into M³.

const fs = require('node:fs');
const path = require('node:path');

const m3TargetDir = (sharedFolder, dateKey) => path.join(sharedFolder, dateKey);

function copyInto(dir, mp4) {
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, path.basename(mp4));
  fs.copyFileSync(mp4, dest);
  return dest;
}

async function deliverVideo({ mp4, sharedFolder, dateKey, desktopDir }) {
  let reason;
  if (!sharedFolder) reason = 'M³ folder not set';
  else if (!fs.existsSync(sharedFolder)) reason = 'M³ folder not found';
  else {
    try {
      return { savedTo: copyInto(m3TargetDir(sharedFolder, dateKey), mp4), fallback: false };
    } catch (err) {
      reason = `Could not write to M³ folder (${err.code || err.message})`;
    }
  }
  return { savedTo: copyInto(desktopDir, mp4), fallback: true, reason };
}

module.exports = { m3TargetDir, deliverVideo };
