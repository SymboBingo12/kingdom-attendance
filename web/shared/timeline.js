'use strict';

// The attendance video's timeline, ported from the approved preview (docs/preview/).
// Deterministic: the same t always draws the same frame, so the video can be rendered frame by frame.

(function (root) {
  const DURATION = 12;
  const FPS = 30;
  const BEATS = { intro: [0, 2.5], hall: [2.5, 5], zoom: [5, 7.5], total: [7.5, 12], foot: [2.5, 12] };
  const COUNT_DELAY = 0.3; // numbers start counting this long into their beat
  const COUNT_TIME = 1.8;
  const ENTER = 0.8;
  const EXIT = 0.5;

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const easeOut = (p) => 1 - Math.pow(1 - p, 4);
  const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const countUp = (t, start, value) => Math.round(value * easeOut(clamp((t - start) / COUNT_TIME)));

  function frameAt(t, d) {
    t = clamp(t, 0, DURATION);
    let beat = 'total';
    for (const k of ['intro', 'hall', 'zoom', 'total']) {
      const [a, b] = BEATS[k];
      if (t >= a && t < b) { beat = k; break; }
    }
    return {
      beat,
      hallShown: countUp(t, BEATS.hall[0] + COUNT_DELAY, d.hall),
      zoomShown: countUp(t, BEATS.zoom[0] + COUNT_DELAY, d.zoom),
      totalShown: countUp(t, BEATS.total[0] + COUNT_DELAY, d.total),
    };
  }

  // How visible one element of a beat is at t: o = opacity, e = arrival 0..1, x = departure 0..1, p = progress through the beat.
  // The departure straddles the boundary, so the next beat fades in while this one fades out.
  function vis(t, beat, delay) {
    const [a, b] = BEATS[beat];
    const last = beat === 'total' || beat === 'foot';
    const e = easeOut(clamp((t - a - delay) / (beat === 'intro' ? 1 : ENTER)));
    const x = last ? 0 : easeInOut(clamp((t - (b - 0.3)) / EXIT));
    return { o: e * (1 - x), e, x, p: clamp((t - a) / (b - a)) };
  }

  const api = { DURATION, FPS, BEATS, frameAt, vis, clamp };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AttendanceTimeline = api;
})(typeof window !== 'undefined' ? window : globalThis);
