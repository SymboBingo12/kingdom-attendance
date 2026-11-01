# Kingdom Hall Attendance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A tray app on the Kingdom Hall AV PC. Phones count the hall in three columns, someone types the Zoom number, and **Finalize** renders a ~12 s attendance video that lands in M³'s shared folder automatically.

**Architecture:** Stage Timer's shape, written fresh. A Node `http` server (port 4590) holds the single meeting state, persists it after every change, and pushes it to phones and the OBS dock over Server-Sent Events.
Pure logic (`meeting.js`, `timeline.js`) is unit-tested. Electron adds the tray, the settings window and the video renderer.
The `/slide` page draws any moment `t` of the animation deterministically, so rendering is frame-exact and testable.

**Tech Stack:** Node 22+, CommonJS, `node --test`, Electron ^45, electron-builder, `bonjour-service`, `qrcode`, and (if the Task 8 spike needs it) `ffmpeg-static`. Plain HTML/CSS/JS pages with Steward tokens.

**Spec:** `docs/superpowers/specs/2026-11-01-attendance-design.md`

**References (read only, never copy without keeping the owner's notice):**
- `C:\Users\ASUS\Kingdom\Stage-Timer\src\core\server.js`: PIN check, loopback without PIN, 429 rate limit, SSE, port fallback, `urls()`.
- `...\Stage-Timer\src\core\mdns.js`: `.local` announce.
- `C:\Users\ASUS\Kingdom\Stage-Countdown\electron\main.cjs`: tray, single instance, start hidden.
- `C:\Users\ASUS\Kingdom\kingdom-project-design\examples\attendance-counter\index.html`: Steward's own attendance counter mock (steppers, tabs). The base for `/count`.

## Global Constraints

- Node ≥ 22; Electron ^45; CommonJS (`"type": "commonjs"`); tests: `npm test` = `node --test "test/*.test.js"`.
- Port **4590**, fallback **4591**. Never 80, 4580 (Stage Timer) or 4578 (Stage Countdown). mDNS name **`attendance.local`**.
- Lanes are exactly `left`, `center`, `right`, shown as **Left**, **Center**, **Right**.
- Numbers only: no names and no personal data anywhere (state, history, logs).
- PIN required for every API call not from loopback; loopback needs none.
- Meeting type: Saturday and Sunday = `weekend`, other days = `midweek`; can be overridden.
- Video: **1920×1080, 30 fps, 12 s, MP4 (H.264)**, plus a PNG of the final frame. Ready ≤ 30 s after Finalize.
- File names: `Attendance YYYY-MM-DD Midweek.mp4` / `… Weekend.mp4` and the same `.png`.
- M³ target: `<M³ shared folder>\<YYYY-MM-DD>\`. Create the date folder if missing. Only the MP4 goes there.
- Slide content: intro ("Meeting Attendance", congregation name, "Midweek Meeting"/"Weekend Meeting", date), then **Kingdom Hall**, **Zoom**, **Total**. No columns. No meeting pictures; no JW.ORG/JW Library logos, names, fonts or art.
- Look: Steward `tokens/tokens.css` and components copied into `web/steward/`. Follow `guidelines/` and `motion/motion.md`.
- Git: author `SymboBingo12 <vjidos12@gmail.com>`; work on branch `feat/attendance-v1`; never push, merge or release without Caio.
- README carries the independence notice; MIT; copyright Caio (SymboBingo12).

## Review Focus

1. **A phone's tap request is retried after a Wi-Fi blip** and must not count twice. Every tap carries a `tapId`, and the server ignores ids it has seen (Task 3).
2. **Wi-Fi drops while an attendant taps.** The page shows "Reconnecting…", disables the buttons and never queues taps silently (Task 5).
3. **Bad Zoom input** (empty, `abc`, `-3`, `12.5`, `100000`) is rejected with a clear message, and the stored value doesn't change (Tasks 1, 3).
4. **Finalize pressed twice, or taps after Finalize.** Taps get 409 "Locked"; a second Finalize while rendering gets 409 "Busy" (Tasks 3, 10).
5. **M³ folder unset, missing or unwritable.** The video goes to the Desktop instead and the dock says exactly where (Task 9).

---

## File Structure

```
package.json  .gitignore  LICENSE  README.md
src/core/meeting.js      pure meeting state + rules
src/core/store.js        current.json + meetings.json, atomic writes, CSV
src/core/settings.js     settings.json with defaults
src/core/service.js      state + store + events + finalize pipeline
src/core/server.js       HTTP API, PIN, SSE, static pages, urls/QR
src/core/mdns.js         attendance.local
src/core/m3.js           M³ shared-folder delivery
src/render/recorder.js   Electron: /slide → MP4 + PNG
src/cli.js               headless server (no video)
src/main.js              Electron: tray, settings window, renderer wiring
src/renderer/            settings window (index.html, app.js, preload.js)
web/steward/             copied Steward tokens + components
web/shared/api.js        fetch with PIN, SSE with reconnect state
web/shared/timeline.js   pure animation timeline (browser + Node)
web/count.html|js  web/dock.html|js  web/slide.html|js  web/history.html|js
test/*.test.js
docs/hall-test-checklist.md
```

---

### Task 1: Repo and meeting rules

**Files:**
- Create: `package.json`, `.gitignore` (`node_modules/`, `dist/`, `release/`), `LICENSE` (MIT, "Copyright (c) 2026 Caio (SymboBingo12)"), `src/core/meeting.js`
- Test: `test/meeting.test.js`

**Interfaces:**
- Produces (all pure; return new objects, never mutate):
  - `type Meeting = { date: 'YYYY-MM-DD', type: 'midweek'|'weekend', lanes: {left:number, center:number, right:number}, zoom: number, finalized: boolean, finalizedAt: string|null }`
  - `dateKey(d: Date) -> string`: local date, `YYYY-MM-DD`
  - `meetingType(d: Date) -> 'midweek'|'weekend'`
  - `newMeeting(d: Date, type?) -> Meeting`
  - `applyTap(m, lane, delta) -> Meeting`: delta ∈ {1, −1}, clamps at 0
  - `setZoom(m, value) -> Meeting`: integer 0..9999
  - `totals(m) -> { hall, zoom, total }`
  - `finalize(m, now: Date) -> Meeting` · `unlock(m) -> Meeting`
  - `rollIfNewDay(m, now: Date) -> { meeting, rolled: boolean }`
  - `class MeetingError extends Error { code: 'LOCKED'|'BAD_LANE'|'BAD_DELTA'|'BAD_ZOOM' }`

- [ ] **Step 1:** `git init`, set the local author (`git config user.name SymboBingo12`, `user.email vjidos12@gmail.com`), `git checkout -b feat/attendance-v1`. Write `package.json` (name `kingdom-attendance`, productName `Kingdom Attendance`, scripts `start: electron .`, `serve: node src/cli.js`, `test`, `dist: electron-builder`). Commit the spec and plan together with the scaffold.
- [ ] **Step 2: Write failing tests** in `test/meeting.test.js`:

```js
const m0 = newMeeting(new Date(2026, 10, 1));            // Sun 1 Nov 2026
assert.deepEqual(m0, { date: '2026-11-01', type: 'weekend', lanes: { left: 0, center: 0, right: 0 }, zoom: 0, finalized: false, finalizedAt: null });
assert.equal(meetingType(new Date(2026, 10, 5)), 'midweek'); // Thu
let m = applyTap(m0, 'left', 1); m = applyTap(m, 'left', 1); m = applyTap(m, 'right', 1);
assert.deepEqual(totals(setZoom(m, 23)), { hall: 3, zoom: 23, total: 26 });
assert.equal(applyTap(m0, 'center', -1).lanes.center, 0);           // never below 0
assert.equal(m0.lanes.left, 0);                                      // input not mutated
for (const bad of ['', 'abc', -3, 12.5, 10000, null]) assert.throws(() => setZoom(m0, bad), { code: 'BAD_ZOOM' });
assert.equal(setZoom(m0, '19').zoom, 19);                            // numeric strings accepted
assert.throws(() => applyTap(m0, 'balcony', 1), { code: 'BAD_LANE' });
assert.throws(() => applyTap(m0, 'left', 5), { code: 'BAD_DELTA' });
const f = finalize(m, new Date());
assert.throws(() => applyTap(f, 'left', 1), { code: 'LOCKED' });
assert.throws(() => setZoom(f, 3), { code: 'LOCKED' });
assert.equal(applyTap(unlock(f), 'left', 1).lanes.left, 3);
assert.equal(rollIfNewDay(m, new Date(2026, 10, 1, 21)).rolled, false);
const r = rollIfNewDay(m, new Date(2026, 10, 5, 19));
assert.equal(r.rolled, true); assert.equal(r.meeting.date, '2026-11-05'); assert.equal(r.meeting.type, 'midweek');
```

- [ ] **Step 3:** Run `npm test`. Expected: FAIL (module not found).
- [ ] **Step 4:** Implement `src/core/meeting.js` to the interface above.
- [ ] **Step 5:** Run `npm test`. Expected: PASS.
- [ ] **Step 6:** Commit: `feat: meeting rules (lanes, zoom, finalize, new day)`.

### Task 2: Persistence, history and settings

**Files:**
- Create: `src/core/store.js`, `src/core/settings.js`
- Test: `test/store.test.js`

**Interfaces:**
- Consumes: `Meeting`, `totals` (Task 1).
- Produces:
  - `createStore(dir) -> { loadCurrent(): Meeting|null, saveCurrent(m), upsertHistory(m), listHistory(): Meeting[] /* newest first */, historyCsv(): string }`. Files `current.json` and `meetings.json` in `dir`. Every write goes to `*.tmp`, then `fs.renameSync` (atomic). History key is `date + type`, so re-finalizing replaces the entry.
  - CSV header exactly: `date,meeting,left,center,right,hall,zoom,total`
  - `loadSettings(dir) -> Settings`, `saveSettings(dir, patch) -> Settings`.
    `Settings = { port: 4590, hostname: 'attendance', pin: string /* 4 random digits, created once */, localNoPin: true, congregation: '', m3Folder: '', theme: 'light' }`

- [ ] **Step 1: Write failing tests** (use `fs.mkdtempSync(os.tmpdir())`):
  - `saveCurrent(m)` then a **new** `createStore(sameDir).loadCurrent()` deep-equals `m` (restart recovery).
  - `loadCurrent()` on an empty dir returns `null`. On a corrupt `current.json` (`"{oops"`) it returns `null` and renames the bad file to `current.corrupt-<timestamp>.json`.
  - `upsertHistory` twice for the same date and type leaves one entry with the later numbers.
  - `historyCsv()` for one meeting (L34 C41 R29, Zoom 23, 2026-11-01 weekend) equals `"date,meeting,left,center,right,hall,zoom,total\n2026-11-01,weekend,34,41,29,104,23,127\n"`.
  - `loadSettings` on an empty dir returns the defaults with a 4-digit `pin`, and a second call returns the same pin.
- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement both modules.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: atomic persistence, history CSV, settings`.

### Task 3: Service and HTTP API

**Files:**
- Create: `src/core/service.js`, `src/core/server.js`, `src/core/mdns.js`, `src/cli.js`
- Test: `test/api.test.js`

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces:
  - `createService({ dataDir, now = () => new Date(), getSettings = () => loadSettings(dataDir), renderer = null, deliver = null }) -> EventEmitter & { getState(), tap(lane, delta, tapId), setZoom(v), finalize(), unlock(), newMeeting(type?), setType(type), rerender() }`.
    `getState() -> { meeting, totals, render: { status: 'idle'|'rendering'|'ready'|'error', message: string, savedTo: string|null }, congregation }`.
    Emits `'change'` with `getState()` after every change. `tap` and `setZoom` call `rollIfNewDay` first.
    `tap` ignores a `tapId` seen among the last 1000 and returns the current state. Every change is saved via the store before emitting.
    `finalize`/`rerender` run the pipeline in Task 10; until then `renderer` may be `null`, leaving `render.status` as `'idle'`.
  - `createServer(service, { settings, webDir, mdns = true }) -> { listen(): Promise<{ port }>, close(), urls(): { count, dock, ip } }`.
  - Routes:
    - `GET /api/whoami`, `/api/state`, `/api/events` (SSE: an initial state event, then every `'change'`; 15 s `:keepalive` comments)
    - `GET /api/connect` (loopback only: urls, pin, QR data-URL of the count link), `/api/history`, `/api/history.csv` (`Content-Disposition: attachment`)
    - `POST /api/tap {lane, delta, tapId}`, `/api/zoom {value}`, `/api/finalize`, `/api/unlock`, `/api/new {type?}`, `/api/type {type}`, `/api/rerender`
    - Pages `/count`, `/dock`, `/zoom` (serves `dock.html`; `dock.js` shows only the Zoom field when the path is `/zoom`), `/slide`, `/history`; `/` redirects to `/count`; static `/steward/*` and `/shared/*`
  - Errors: `BAD_*` → 400 `{error}`; `LOCKED` → 409 `"Attendance is finalized. Unlock to change it."`; `BUSY` → 409 `"Still making the video."`; wrong PIN → 401; 5 wrong PINs in a minute from one IP → 429.
  - `listen()` tries `settings.port`, then `settings.port + 1`. `cli.js` starts it headless, with the data dir from `--data` or `./data`.

- [ ] **Step 1: Write failing tests** against a real server on port `0`, using `fetch`. Requests from the test are loopback, so set `localNoPin: false` in the PIN tests.
  - Two parallel batches of 50 `POST /api/tap {lane:'left', delta:1, tapId:<unique>}` give `left === 100`.
  - The same `tapId` sent twice counts once.
  - `POST /api/zoom {value:'abc'}` → 400 and zoom unchanged; `{value:'23'}` → 200 and `totals.zoom === 23`.
  - After `/api/finalize`, `/api/tap` → 409 with the exact LOCKED message; after `/api/unlock` → 200.
  - With `localNoPin:false`: no `x-pin` → 401, right pin → 200, the 6th wrong pin within a minute → 429.
  - `GET /api/events` receives an initial state event, and another event within 1 s of a tap.
  - A fresh service on the same data dir after `close()` returns the same lanes.
  - With `now` set to the next Thursday, a tap returns a new midweek meeting with only that tap counted, and the previous meeting is not lost (it's in history if finalized; otherwise it is simply replaced, which matches the spec).
- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement. Follow Stage Timer's `server.js` for PIN/loopback (`safeEqual`), body limits and SSE headers, written fresh. `mdns.js` announces `${settings.hostname}.local` via `bonjour-service`, and failures are logged, never thrown.
- [ ] **Step 4:** Run `npm test`. Expected: PASS. Then `npm run serve` and `curl http://localhost:4590/api/state` returns JSON.
- [ ] **Step 5:** Commit: `feat: service, HTTP API with PIN, SSE and tap de-dup`.

### Task 4: Steward assets and the shared client

**Files:**
- Create: `web/steward/` (copy `tokens/tokens.css` and the `components/*.css` that the pages use from `C:\Users\ASUS\Kingdom\kingdom-project-design`, plus a `SOURCE.md` naming the commit copied), `web/shared/api.js`
- Test: `test/client-api.test.js`

**Interfaces:**
- Produces, in `web/shared/api.js` (works as a browser global `AttendanceApi`; `module.exports` when `typeof module !== 'undefined'`):
  - `createApi({ base = '', getPin, onPinNeeded }) -> { post(path, body), get(path), subscribe(onState, onStatus) }`
  - `post` sends `x-pin` and **does not retry**: it rejects with `{status, message}`.
  - `subscribe` uses `EventSource('/api/events')` and calls `onStatus('live'|'reconnecting')`.
  - `newTapId() -> string` (time + random, unique per call).
- [ ] **Step 1:** Write a failing test: with `global.fetch` stubbed, `post` sets `x-pin` from `getPin()`, a 401 calls `onPinNeeded`, a network error rejects without a second fetch call, and 1000 `newTapId()` calls are unique.
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement and copy the Steward files. **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: Steward assets and client API helper`.

### Task 5: Phone counting page `/count`

**Files:**
- Create: `web/count.html`, `web/count.js`

**Interfaces:**
- Consumes: `AttendanceApi` (Task 4), `/api/state`, `/api/tap`, `/api/events`.

Layout, based on Steward's `examples/attendance-counter`:
- **Top:** "Kingdom Hall" with the live hall total (large), the meeting label ("Weekend meeting · 1 Nov") and a live/reconnecting pill.
- **Three lanes**, one per column. Each lane has its name, its live number, a large **+** (most of the lane's height, ≥ 96 px tall) and a smaller **−** (≥ 48 px).
- **PIN screen:** shown when the API asks for the PIN. 4 digits, remembered in `localStorage` (inside try/catch).
- **Locked:** when the meeting is finalized, the lanes are dimmed and show "Finalized. Ask the AV desk to unlock."
- **Reconnecting:** the buttons are disabled and the pill reads "Reconnecting…".
- **Tap feedback:** a short Steward press animation. Mobile rules: no double-tap zoom (`touch-action: manipulation`), no text selection or long-press callout, safe-area padding, `100dvh`.

- [ ] **Step 1:** Build the page. On tap: `post('/api/tap', {lane, delta, tapId: newTapId()})`. If it fails, show a toast with the message; the number shown comes only from the server.
- [ ] **Step 2: Verify:**
  1. With `npm run serve` running, open `/count` in two browser tabs. A tap in one updates the other within 1 s.
  2. Stop the server: both tabs show "Reconnecting…" with the buttons disabled. Restart it: they go live again with the same numbers.
- [ ] **Step 3:** Take headless Edge screenshots at 390×844 (light and dark) and 1280×800. Check that nothing overflows and the + targets are big enough. Use `msedge --headless --screenshot=<file> --window-size=390,844 http://localhost:4590/count`.
- [ ] **Step 4:** Commit: `feat: phone counting page`.

### Task 6: OBS dock `/dock` and history `/history`

**Files:**
- Create: `web/dock.html`, `web/dock.js`, `web/history.html`, `web/history.js`

**Interfaces:**
- Consumes: Task 3 routes, Task 4 client. The dock reads `render.status`, `render.message` and `render.savedTo` (filled by Task 10).

Dock (fits an OBS dock 300–500 px wide):
- **Summary block:** `Hall  Left 34 · Center 41 · Right 29  = 104` / `Zoom = 23` / `TOTAL = 127`.
- **Zoom number field:** saves on Enter or blur, shows "Saved", and shows the 400 message inline.
- **Meeting type:** Steward segmented control, Midweek | Weekend.
- **Primary button:** **Finalize**. When finalized it becomes **Unlock**, with a secondary **Make video again**.
- **Render status line:**
  - idle: nothing
  - rendering: "Making the video…" with a progress indicator
  - ready: "Ready in M³: <path>" or "Saved to Desktop: <path>"
  - error: the message
- **Links:** "New meeting" (asks to confirm), "Connect a phone" (shows the QR and PIN from `/api/connect`), "History".

History: a table of past meetings (date, meeting, hall, Zoom, total), newest first, with a **Download CSV** link to `/api/history.csv`.

- [ ] **Step 1:** Build both pages.
- [ ] **Step 2: Verify:**
  1. In the dock, type `abc` in Zoom: the inline error appears and the value is unchanged. Type 23: the total updates on `/count` too. `/zoom` at 390×844 shows only the Zoom field and works with the PIN.
  2. Finalize: `/count` locks. Unlock: it unlocks.
  3. Screenshots of the dock at 320×700 and 480×700 (light and dark) and of history at 1280×800.
- [ ] **Step 3:** Commit: `feat: OBS dock and history pages`.

### Task 7: Animation timeline and `/slide`

**Files:**
- Create: `web/shared/timeline.js`, `web/slide.html`, `web/slide.js`
- Test: `test/timeline.test.js`

**Interfaces:**
- Produces:
  - `timeline.js` (browser global `AttendanceTimeline`, plus `module.exports`): `DURATION = 12`, `FPS = 30`, `BEATS = { intro:[0,2.5], hall:[2.5,5], zoom:[5,7.5], total:[7.5,12] }`.
  - `frameAt(t, { hall, zoom, total }) -> { beat, hallShown, zoomShown, totalShown, enter: 0..1 }`. Each number counts up over 1.8 s, starting 0.3 s into its beat, with ease-out-quart (`1-(1-p)^4`), rounded to integers. Port `frameAt` and `vis` from `docs/preview/attendance-video-preview.html`, the approved prototype. After its count it holds the exact value. `t` is clamped to `[0, DURATION]`.
  - `/slide?hall=&zoom=&total=&type=&date=&cong=&theme=`: draws the frame at `?t=` (default `DURATION`, the final frame). Exposes `window.renderAt(t) -> Promise<void>`, which resolves after paint (double `requestAnimationFrame`). `?play=1` plays in real time. `?live=1` reads `/api/events` and replays from 0 whenever the meeting becomes finalized (OBS browser-source fallback).
- [ ] **Step 1: Write failing tests:**

```js
const d = { hall: 104, zoom: 23, total: 127 };
assert.equal(frameAt(0, d).beat, 'intro');
assert.equal(frameAt(2.6, d).hallShown, 0);
assert.equal(frameAt(4.7, d).hallShown, 104);
assert.equal(frameAt(7.2, d).zoomShown, 23);
assert.equal(frameAt(12, d).totalShown, 127);
assert.equal(frameAt(99, d).beat, 'total');
let prev = -1; for (let t = 2.8; t <= 4.6; t += 1/30) { const v = frameAt(t, d).hallShown; assert.ok(v >= prev); prev = v; } // never counts down
```

- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement `timeline.js`. **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Build the slide.** It must stay readable at Zoom-thumbnail size.
  1. **Intro:** "Meeting Attendance", the congregation name, "Weekend Meeting", "1 November 2026".
  2. **Kingdom Hall:** a large number.
  3. **Zoom:** a large number.
  4. **Total:** a very large number, with "Kingdom Hall 104 · Zoom 23" beneath.
  Use Steward type, colour and art primitives only; smooth motion exactly as the prototype (0.8 s ease-out-quart arrivals, 0.5 s crossfades, ≤ 3 % art drift, nothing bouncy).
  **Light theme by default** (Caio's choice for a presentation): white, ink, coral eyebrows. Settings can switch to dark.
- [ ] **Step 6: Verify:** Edge screenshots at 1920×1080 for `t` = 1, 3.5, 6, 12 in both themes. Read them for legibility and that no meeting image or official mark is present. Then shrink one to 320×180 and check the total is still readable.
- [ ] **Step 7:** Commit: `feat: deterministic attendance animation`.

### Task 8: Video renderer (Electron)

**Files:**
- Create: `src/render/recorder.js`, `scripts/render-sample.js`
- Test: `test/recorder.smoke.js` (run by hand through Electron, not part of `npm test`)

**Interfaces:**
- Consumes: `/slide` and `renderAt(t)` (Task 7), `DURATION`, `FPS`.
- Produces: `renderAttendance({ slideUrl, outDir, fileBase }) -> Promise<{ mp4: string, png: string }>`. It opens a hidden, non-focusable `BrowserWindow` sized **1920×1080** with `backgroundThrottling: false` and `offscreen: true`, and closes it in `finally`.

- [ ] **Step 1: Spike (time-boxed to 1 hour). Pick the encoder and write the result in the commit message.**
  - **(a)** In Electron, does `MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')` return true? If so, record `captureStream()` from a canvas fed by the offscreen paint frames.
  - **(b)** Otherwise, step `t = i / FPS` for `i = 0..DURATION*FPS`, call `renderAt(t)` then `webContents.capturePage()`, and pipe the frames as PNG to `ffmpeg-static` with `-f image2pipe -framerate 30 -i - -c:v libx264 -pix_fmt yuv420p -movflags +faststart`. Add `ffmpeg-static` to dependencies and `asarUnpack` it; ship ffmpeg's licence in `LICENSES/`.
  - Pick the one that renders in **≤ 30 s** on this PC and produces H.264. If both do, prefer (b) for frame accuracy.
- [ ] **Step 2:** Implement `renderAttendance`. The PNG is the frame at `t = DURATION`.
- [ ] **Step 3: Verify:** `npx electron scripts/render-sample.js`:
  1. Writes `Attendance 2026-11-01 Weekend.mp4` and `.png` to a temp dir.
  2. The MP4 starts with an `ftyp` box, is 1920×1080, and lasts 12 s ± 0.2 (check with `ffmpeg -i` from `ffmpeg-static`).
  3. It plays in Windows Media Player and in Chrome.
  4. The render time is printed. Expected: under 30 s.
- [ ] **Step 4:** Commit: `feat: MP4 renderer (<encoder chosen>)`.

### Task 9: M³ delivery

**Files:**
- Create: `src/core/m3.js`
- Test: `test/m3.test.js`

**Interfaces:**
- Produces:
  - `m3TargetDir(sharedFolder, dateKey) -> string`: `path.join(sharedFolder, dateKey)`
  - `deliverVideo({ mp4, sharedFolder, dateKey, desktopDir }) -> Promise<{ savedTo: string, fallback: boolean, reason?: string }>`. Copies (doesn't move) the MP4 into the target dir, creating it if missing. An existing file with the same name is replaced.
- [ ] **Step 1: Write failing tests** with temp dirs:
  - Delivery into an existing shared folder → `<shared>/2026-11-01/Attendance 2026-11-01 Weekend.mp4`, with `fallback:false`.
  - Missing date folder → created.
  - `sharedFolder: ''` → saved to `desktopDir`, with `fallback:true` and `reason:'M³ folder not set'`.
  - A shared folder that doesn't exist → Desktop, with `reason:'M³ folder not found'`.
  - Unwritable target (a file named `2026-11-01` sitting where the folder should be) → Desktop, with `reason` starting `'Could not write to M³ folder'`.
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: deliver video to M³ shared folder with Desktop fallback`.

### Task 10: Finalize pipeline

**Files:**
- Modify: `src/core/service.js`
- Test: `test/finalize.test.js`

**Interfaces:**
- Consumes: `renderer: ({ meeting, totals, congregation, theme }) -> Promise<{ mp4, png }>` (Task 8, wrapped by `main.js`) and `deliver: ({ mp4, dateKey }) -> Promise<{ savedTo, fallback, reason? }>` (Task 9's `deliverVideo`, wrapped by `main.js` with `sharedFolder` from settings and the Desktop path). `congregation` and `theme` come from `getSettings()`.
- `finalize()`:
  1. Locks the meeting, `upsertHistory`, sets `render.status = 'rendering'` and emits.
  2. Awaits `renderer`, then `deliver`.
  3. Sets status `'ready'` with `savedTo` and `message` (`"Ready in M³"` or `"Saved to Desktop (<reason>)"`), and emits.
  4. On any throw: status `'error'` with message `"Couldn't make the video: <err.message>. The numbers are saved. Try Make video again."`. The meeting stays finalized.
  While rendering, `finalize`/`rerender`/`unlock` throw `BUSY`. `rerender()` re-runs steps 2–3 for the finalized meeting. With `renderer === null` (headless), it finalizes and leaves status `'idle'`.
- [ ] **Step 1: Write failing tests** with fake renderer and deliver:
  - The status sequence emitted is `rendering → ready`.
  - A second `finalize()` during rendering throws `BUSY`.
  - A renderer that rejects gives status `error`; the meeting stays finalized and history has the entry.
  - `rerender()` after an error reaches `ready`.
  - Unlock, change a tap, finalize again: history has one entry with the new numbers.
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: finalize pipeline with busy and error states`.

### Task 11: Electron shell and settings window

**Files:**
- Create: `src/main.js`, `src/renderer/index.html`, `src/renderer/app.js`, `src/renderer/preload.js`, `assets/icon.png` (original simple glyph, Steward colours)

**Interfaces:**
- Consumes: everything above. `main.js` builds the service with `renderer = (args) => renderAttendance({ slideUrl: <loopback /slide URL built from args>, outDir: <userData>/slides, fileBase })` and `deliver = (r) => deliverVideo({ ..., desktopDir: app.getPath('desktop') })`.

Behaviour:
- Single instance. The tray menu has Open, Open dock in browser, Quit (confirmed).
- Closing the window hides it to the tray.
- Starts with Windows, hidden (`app.setLoginItemSettings({ openAtLogin: true, args: ['--hidden'] })`), with a toggle in Settings.
- Data dir is `app.getPath('userData')`.

Settings window, in Steward style:
- The count link, dock link and IP link, each with a Copy button; the QR code; the PIN with a "New PIN" button.
- Congregation name.
- M³ shared folder: a Browse button (`dialog.showOpenDialog({properties:['openDirectory']})`) and the help line "In M³: Settings → Integrations → Shared folder → turn on 'Add media from a shared folder' and choose this same folder."
- Theme (Dark/Light).
- Start with Windows.
- OBS dock instructions: View → Docks → Custom Browser Docks → `http://localhost:4590/dock`.

- [ ] **Step 1:** Implement.
- [ ] **Step 2: Verify** with `npm start`:
  1. Tray icon appears; closing the window keeps it running; a second launch focuses the first.
  2. A phone on the same Wi-Fi opens the QR link, enters the PIN and counts.
  3. Finalize in the dock: the MP4 appears in `<chosen folder>\<today>\` within 30 s and the dock says "Ready in M³".
- [ ] **Step 3:** Commit: `feat: Electron tray app and settings`.

### Task 12: Installer, README and hall checklist

**Files:**
- Modify: `package.json` (`build` block: appId `com.symbobingo12.attendance`, NSIS, `artifactName: Kingdom-Attendance-Setup-${version}.exe`, files `src/** web/** assets/** package.json`, no `publish`)
- Create: `README.md`, `docs/hall-test-checklist.md`

- [ ] **Step 1: README** in Caio's voice (`guidelines/voice.md`):
  - What it does, quick start for the AV, the attendant's "scan, PIN, tap +", and M³ shared-folder setup.
  - The OBS dock URL, the pages table, ports (4590/4591, `attendance.local`), privacy ("numbers only, nothing leaves the hall Wi-Fi").
  - The independence notice ("An independent project. Not affiliated with or endorsed by any organisation."), MIT, copyright Caio.
- [ ] **Step 2: `docs/hall-test-checklist.md`.** A run-through on the real hall PC before the first live meeting:
  1. M³ shared folder on, MP4 appears in that meeting's list and plays in M³'s media window, OBS shows it to Zoom.
  2. Two phones counting at once.
  3. The Wi-Fi drop test.
  4. Restart the PC mid-count; the numbers are still there.
  5. Time from Finalize to playable MP4.
- [ ] **Step 3:** `npm run dist`. Install the result on this PC, run the checklist items that are possible without M³ (the rest at the hall), and note the results in the checklist.
- [ ] **Step 4:** Commit: `docs: README, hall checklist; build: Windows installer`.
