'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { DURATION, FPS, BEATS, frameAt, vis } = require('../web/shared/timeline');

const d = { hall: 104, zoom: 23, total: 127 };

test('the video is 12 s at 30 fps in four beats', () => {
  assert.equal(DURATION, 12);
  assert.equal(FPS, 30);
  assert.deepEqual(BEATS.intro, [0, 2.5]);
  assert.deepEqual(BEATS.hall, [2.5, 5]);
  assert.deepEqual(BEATS.zoom, [5, 7.5]);
  assert.deepEqual(BEATS.total, [7.5, 12]);
});

test('each beat shows at its time', () => {
  assert.equal(frameAt(0, d).beat, 'intro');
  assert.equal(frameAt(3, d).beat, 'hall');
  assert.equal(frameAt(6, d).beat, 'zoom');
  assert.equal(frameAt(12, d).beat, 'total');
  assert.equal(frameAt(99, d).beat, 'total');
  assert.equal(frameAt(-5, d).beat, 'intro');
});

test('numbers count up to their exact values and hold', () => {
  assert.equal(frameAt(2.6, d).hallShown, 0);
  assert.equal(frameAt(4.7, d).hallShown, 104);
  assert.equal(frameAt(7.2, d).zoomShown, 23);
  assert.equal(frameAt(12, d).totalShown, 127);
});

test('counting never goes backwards', () => {
  let prev = -1;
  for (let t = 2.8; t <= 4.6; t += 1 / FPS) {
    const v = frameAt(t, d).hallShown;
    assert.ok(v >= prev, `t=${t}`);
    prev = v;
  }
});

test('beats crossfade: the hall fades in as the intro fades out', () => {
  const introOut = vis(2.55, 'intro', 0);
  const hallIn = vis(2.55, 'hall', 0);
  assert.ok(introOut.o > 0 && introOut.o < 1, `intro ${introOut.o}`);
  assert.ok(hallIn.o > 0 && hallIn.o < 1, `hall ${hallIn.o}`);
  assert.equal(vis(12, 'total', 0).o, 1);
  assert.equal(vis(12, 'intro', 0).o, 0);
});
