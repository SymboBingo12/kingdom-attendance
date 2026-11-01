# Kingdom Attendance v2 (names, one link, Settings) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Attendants mark each person KH or Zoom by name on their phones, through one link with a home screen, and the AV
computer gets the overseer's workbook plus all v1 settings inside the same web app.

**Architecture:** The rules stay pure functions in `src/core/meeting.js` (marks, unnamed visitors and added visitors
join lanes and zoom), the list lives in `src/core/roster.js` and `publishers.json`, and the server gains name, roster,
settings and workbook routes, with AV-only routes guarded by the existing loopback check. The web side becomes one page,
`web/app.html`, with hash-routed views in `web/app/`. The Electron window loads that page instead of
`src/renderer/`, and hands native actions (folder picker, open folder, updates) to the server through a `host` object.

**Tech Stack:** Node 22, Electron 45, plain HTML/JS (no framework), Steward tokens and components (`web/steward/`),
`exceljs@^4.4.0` (MIT) for reading and writing `.xlsx`, `node:test`.

**Spec:** `docs/superpowers/specs/2026-11-01-names-one-link-design.md`. Mockup: `docs/preview/one-link/index.html`. The
mockup's screens, copy, CSS and art are the reference; port them, don't redesign.

## Global Constraints

- Names never reach the video renderer (`/slide`, `src/render/`), the repo, logs or test fixtures. Tests use made-up names only.
- AV-only routes answer `403 { error: 'Only on the AV computer.' }` when `isLoopback(req.socket.remoteAddress)` is false.
- Appearance default stays `light`. Video colours (`theme`) stay separate from Appearance.
- Steward rules: tap targets ≥ 44 px (main 56), colour never the only signal, art only at task edges, motion per `motion/motion.md`, reduced motion respected.
- Voice: plain words, verbs on buttons, errors say what to do next (`guidelines/voice.md`).
- v1 data files (`current.json`, `meetings.json` without `marks`) must load unchanged and total correctly.
- Commit as `SymboBingo12 <vjidos12@gmail.com>` on `feat/attendance-v1`; never push or release without Caio.
- Version `0.3.0`.

## Review Focus

1. **v1 files on the hall PC:** a `current.json` and `meetings.json` saved by 0.2.0 (no `marks`, `unnamed`, `visitors`, `people`) load, total, export and finalize correctly. *Test in Task 2.*
2. **A bad upload:** a 0-byte file, a renamed PDF, a `.xls`, a 6 MB file, or a sheet with no names gives a plain error (`That file couldn't be read. Save it as .xlsx or .csv and try again.` / `No names found…`), never a crash or an empty list saved. *Test in Task 1 and Task 5.*
3. **Two phones, one person:** two phones tap KH and Zoom for the same id at once, or a phone retries the same `tapId`. One mark results, last write wins, no double count. *Test in Task 3.*
4. **A phone calling AV-only routes** (finalize, unlock, new, type, rerender, roster import/add/remove, settings, host actions) gets 403, with the PIN or without. *Test in Task 5.*
5. **Hostile names:** a name like `<img src=x onerror=alert(1)>` or `=HYPERLINK(...)` shows as text in every view and is written to the workbook as a plain string, not a formula. *Test in Task 4 and Task 7.*

---

### Task 1: Read publisher lists (`roster.js`)

**Files:**
- Create: `src/core/roster.js`
- Test: `test/roster.test.js`
- Modify: `package.json` (add `exceljs`)

**Interfaces:**
- Produces:
  - `householdSize(name: string) => 1 | 2`
  - `parseRows(rows: string[][]) => { name, group, size }[]`
  - `readListFile(buf: Buffer, filename: string) => Promise<{ sheets: { name: string, people: {name,group,size}[] }[] }>`, which throws `RosterError` with code `BAD_FILE`
  - `TEMPLATE_CSV: string`
  - `MAX_LIST_BYTES = 5 * 1024 * 1024`

- [ ] **Step 1: Write failing tests** (made-up names only):
  - `parses the attendance-sheet layout`: rows `[['RIVERSIDE (Oct. 28)'], ['PUBLISHER ','ZOOM','KINGDOM HALL'], ['Santos, Ana','',1], ['Reyes, Mark & Joy','',2], [], ['CLMS'], ['Navarro, Ella'], ['JW VISITORS ZOOM / KH'], ['Lim, Grace'], ['INVITED THRU ZOOM'], ['TECNO LH8'], ['KC & LIAH CRUZ'], ['Total KH Visitors','',1], ['SUB-TOTAL','=SUM(B3:B9)'], ['After, Total']]` gives 7 people. Groups `Publishers ×2, CLMS ×1, JW VISITORS ZOOM / KH ×1, INVITED THRU ZOOM ×3`. `Reyes, Mark & Joy` and `KC & LIAH CRUZ` have size 2. Nothing after SUB-TOTAL.
  - `reads a Name/Group template`: `TEMPLATE_CSV` round-trips to its 3 people with their groups.
  - `pasted lines`: `['Ana','','VISITORS','Lim']` gives Ana in Publishers and Lim in VISITORS.
  - `xlsx with several sheets`: build a workbook in the test with exceljs (sheet "MIDWEEK" 3 names, "SUMMARY" with names only in column B). `readListFile` returns both sheets, with 3 and 0 people.
  - `bad files`: an empty Buffer, `Buffer.from('%PDF-1.4')` named `a.xlsx`, and anything named `.xls` all reject with code `BAD_FILE`.
- [ ] **Step 2: Run `node --test test/roster.test.js`.** Expect FAIL (module missing).
- [ ] **Step 3: Implement** with the mockup's rules (spec §8). Detect CSV by `.csv` extension. A quote-aware CSV split is enough (no new dependency). Use exceljs `Workbook().xlsx.load(buf)`, reading cell `.text` (formulas read as their text). Size limit check: reject a `buf.length` over `MAX_LIST_BYTES` with `BAD_FILE`. Group words regex: `/\b(CLMS|VISITORS?|INVITED|GUESTS?|STUDENTS?|GROUP|PUBLISHERS|INTERESTED)\b/` on lines with no lowercase letters.
- [ ] **Step 4: Run the tests.** Expect PASS. Then `npm test`: all pass.
- [ ] **Step 5: Commit** `feat: read publisher lists from Excel, CSV or pasted text`.

### Task 2: Marks in the meeting rules (`meeting.js`)

**Files:**
- Modify: `src/core/meeting.js`
- Test: `test/meeting.test.js`

**Interfaces:**
- Produces, as pure functions throwing `MeetingError`:
  - `upgrade(m) => m`: fills `marks: {}`, `unnamed: 0`, `visitors: []` when missing;
  - `newMeeting` includes those fields;
  - `setMark(m, id: string, where: 'kh'|'zoom'|null, n?: 1..20)`: codes `BAD_MARK` and `LOCKED`;
  - `bumpUnnamed(m, delta: 1|-1)`: `BAD_DELTA`, floored at 0;
  - `addVisitor(m, name: string) => { meeting, id }`: ids `v1`, `v2`…; name trimmed to 1–80 chars, else `BAD_NAME`;
  - `dropMarks(m, keepIds: Set<string>)`;
  - `totals(m)`: `hall = lanes + unnamed + Σ kh n`, `zoom = m.zoom + Σ zoom n`.

- [ ] **Step 1: Write failing tests:**
  - `a v1 meeting without marks totals as before`: the v1 shape `{lanes:{left:3,center:4,right:5}, zoom:2}` gives `{hall:12, zoom:2, total:14}`.
  - `marks add households`: `setMark(m,'p1','kh',2)` and `setMark(m,'p2','zoom')` give hall 2, zoom 1. Re-marking `p1` as `'zoom'` keeps n 2 and moves it. `setMark(m,'p1',null)` removes the mark.
  - `unnamed visitors count toward the hall`.
  - `added visitors get v-ids and can be marked`.
  - `marks are locked after finalize` (code `LOCKED`).
  - `bad input`: `where:'roof'`, `n:0`, `n:21` give `BAD_MARK`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** Use `upgrade()` inside `totals` and every setter, so v1 objects work.
- [ ] **Step 4: Run, expect PASS.** Then `npm test`.
- [ ] **Step 5: Commit** `feat: marks, households and visitors in the meeting rules`.

### Task 3: The list and marks in the service and store

**Files:**
- Modify: `src/core/store.js`, `src/core/service.js`
- Test: `test/store.test.js`, `test/api.test.js` (service-level cases go in a new `test/service-names.test.js`)

**Interfaces:**
- Consumes: Task 1 people, Task 2 rules.
- Produces:
  - **Store:** `loadRoster() => Person[]`, `saveRoster(list)` (`publishers.json`; `Person = {id:'p<n>', name, group, size}`).
  - **Service:**
    - `getRoster()`, `importRoster(people)`, `addPerson(name, group)`, `removePerson(id)`;
    - `mark(id, where, n, tapId)`, `unnamed(delta, tapId)`, `addVisitor(name, where)`.
  - **`getState()`** adds `roster`, `visitors` and `mode: 'names'|'columns'` (names when the roster is non-empty).
  - **`finalize()`** writes the history entry with `people: [...roster, ...visitors]` (snapshot).
- Rules:
  - `importRoster` assigns new ids `p1…` and clears today's marks.
  - `addPerson` uses the next id after the highest existing one.
  - `removePerson` drops that id's mark from today's meeting.
  - Every mark-type call uses the same `seen` tapId de-dup as taps.

- [ ] **Step 1: Write failing tests:**
  - **Snapshot:** after `importRoster`, `mark` and `finalize`, then `removePerson`, `listHistory()[0].people` still holds the removed person and their mark.
  - **Two phones, same person** (Review Focus 3): `mark('p1','kh',1,'t1')` and `mark('p1','zoom',1,'t2')` give one mark, zoom; replaying `'t1'` changes nothing; zoom total 1.
  - **v1 files** (Review Focus 1): write a v1 `current.json` and `meetings.json` into a temp dir. `createService` loads them, `getState().totals` match, `finalize()` works, and the CSV is unchanged in format.
  - **CSV:** stays numbers only, with no `people` field in it.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** Update store.js's header comment (it currently says "no names").
- [ ] **Step 4: Run, expect PASS.** Then `npm test`.
- [ ] **Step 5: Commit** `feat: publisher list, name marks and history snapshots in the service`.

### Task 4: The overseer's workbook (`workbook.js`)

**Files:**
- Create: `src/core/workbook.js`
- Test: `test/workbook.test.js`

**Interfaces:**
- Produces `buildOverseerWorkbook({ history, congregation }) => Promise<Buffer>`. `history` is `listHistory()` output.

- [ ] **Step 1: Write failing tests** (read the result back with exceljs):
  - **Sheets:** `WEEKEND MEETING (Nov 01)`, `MIDWEEK MEETING (Oct 28)`, then `SUMMARY (AVERAGE)`, newest first. Names are capped at 31 chars; a duplicate gets a ` (2)` suffix.
  - **A names meeting:**
    - Row 1 `RIVERSIDE CONGREGATION (Sunday, November 1)`.
    - Row 2 `PUBLISHER | ZOOM | KINGDOM HALL`.
    - Then people by group, in snapshot order, with a blank row and the heading before each later group.
    - Zoom n in B, KH n in C.
    - `Unnamed visitors` in C.
    - `SUB-TOTAL` gives zoom and hall numbers (values, not formulas).
    - `TOTAL` gives the total.
  - **A columns meeting:** rows `Left / Center / Right` in C, plus `Zoom (typed total)` in B.
  - **Summary:**
    - A row per meeting (`date, Weekend|Midweek, zoom, hall, total`).
    - A monthly average row per month and type, over meetings that happened only. Fixture: midweek Oct 21 with 90 and Oct 28 with 94 gives `Average, midweek, October 2026` total 92.
    - The note `Weeks with no meeting (assemblies, conventions) are left out of the averages.`
  - **Hostile name** (Review Focus 5): the name `=HYPERLINK("x")` comes back as a string value starting with `=`, and the cell has no formula.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** with exceljs. Bold heading rows. Column A width 34. Number formats are plain integers.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** `feat: overseer workbook in the attendance-sheet layout`.

### Task 5: Server routes, AV-only guard, one-link pages

**Files:**
- Modify: `src/core/server.js`, `src/cli.js`
- Test: `test/api.test.js`, `test/api-names.test.js` (new)

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces `createServer(service, { settings, webDir, mdns, host })`, where `host` is optional. Its interface, faked in tests:
  - `version: string`
  - `saveSettings(patch) => settings`, which applies the side effects
  - `newPin() => settings`
  - `chooseFolder() => Promise<string|null>`
  - `openFolder('m3'|'videos') => void`
  - `updateStatus() => {state,message,version,percent}`
  - `checkUpdate() => Promise<void>`
  - `installUpdate() => boolean`

  `cli.js` builds a host from `settings.js`, with no-op native actions and `updateStatus` returning `unsupported`.
- **Routes:**
  - **PIN level:**
    - `POST /api/mark {id, where, n?, tapId?}`
    - `POST /api/unnamed {delta, tapId?}`
    - `POST /api/visitor {name, where}`
    - `POST /api/zoom` (kept)
    - `GET /api/roster`
    - `GET /api/history.xlsx` (attachment `Attendance for the circuit overseer.xlsx`)
  - **AV-only:**
    - `POST /api/finalize|unlock|new|type|rerender` (now AV-only)
    - `POST /api/roster/preview` (raw body up to `MAX_LIST_BYTES`, header `x-filename`) returns `{sheets}`
    - `POST /api/roster {people}`
    - `POST /api/roster/add {name, group}`
    - `POST /api/roster/remove {id}`
    - `GET /api/settings` returns `{settings, links: urls(), version, update}`
    - `POST /api/settings {congregation, theme, appearance, openAtLogin, autoUpdate}` (whitelisted)
    - `POST /api/pin/new`
    - `POST /api/host/choose-folder|open-folder|check-update|install-update`
- **Pages:**
  - `GET /` and `GET /desk` serve `app.html`.
  - `/count` and `/zoom` 302 to `/`; `/dock` to `/desk`; `/history` to `/#/history`.
  - Static dir `app` added. `slide.html` unchanged.
  - Keep `/api/connect` but return `count` = the one link (`/`).

- [ ] **Step 1: Write failing tests:**
  - **Phone guard** (Review Focus 4): a server whose loopback check is faked as false (inject `isLocal` via an option `trustLoopback: false` used only by tests). Every AV-only route returns 403 with or without the PIN, while `/api/mark` with the PIN returns 200.
  - **Bad uploads** (Review Focus 2): an empty body, a 6 MB body and a PDF-bytes body to `/api/roster/preview` return 400 `That file couldn't be read. Save it as .xlsx or .csv and try again.`. The roster stays unchanged.
  - **Redirects and pages:** `/count`, `/zoom` and `/dock` redirect; `/` and `/desk` give HTML; `/app/main.js` is served; `/../package.json` returns 404.
  - **The workbook:** `GET /api/history.xlsx` after a finalize gives an exceljs-readable file.
  - **Settings round-trip:** values go through the fake host, and an unknown key is ignored.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** `readBody` takes a limit. The preview route reads the raw buffer. The existing `send`, `STATUS` and `authorised` stay. Map new `MeetingError` and `RosterError` codes to 400.
- [ ] **Step 4: Run `npm test`, expect PASS.**
- [ ] **Step 5: Commit** `feat: name, list, settings and workbook routes; one link with old links redirected`.

### Task 6: Web app shell, PIN, home, art and icons

**Files:**
- Create:
  - `web/app.html`
  - `web/app/main.js` (router, connection, state)
  - `web/app/ui.js` (helpers: `esc`, `bar`, `tiles`, `icon(name)`, `pill`)
  - `web/app/model.js` (UMD like `shared/api.js`: `groupsOf(people)`, `visible(person, marks, q, filter)`, `countMarked(people, marks)`)
  - `web/app/home.js`, `web/app/pin.js`
  - `web/shared/attendance-art.js` (port of `docs/preview/one-link/attendance-art.js`, self-contained: own `halftone` and `person`, exposes `window.AttendanceUiArt`; uses `AttendanceArt.remoteArt` from `shared/art.js`)
- Test: `test/model.test.js`

**Interfaces:**
- Consumes: Task 5 routes, `shared/api.js` (`createApi`, `pinStore`, `newTapId`), `shared/appearance.js`.
- Produces:
  - Views register as `window.Views[name] = { render(state, ctx) => html, bind?(root, ctx) }`.
  - `ctx = { api, go(route), isAV, state, refresh() }`.
  - Routes: `#/`, `#/mark`, `#/history`, `#/history/<i>`, `#/desk`, `#/list`, `#/setup`, `#/settings`. `/desk` starts at `#/desk`.
  - `isAV` comes from `/api/whoami` `local`. On the AV computer, AV-only cards and routes show; elsewhere `#/desk`, `#/list`, `#/setup` and `#/settings` redirect to `#/`.

- [ ] **Step 1: Write failing tests:** `groupsOf` keeps first-seen group order; `visible` handles filters `all|none|kh|zoom` and a case-insensitive search.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** Port the mockup's CSS (minus the mockup chrome) into `app.html`. Port Home and PIN copy exactly, with icons `mark/history/desk/list/settings`. The PIN view uses `markArt`, and the home header uses `attendanceHeroArt` with `st-rest`. Live state comes over SSE as in v1, with "Reconnecting…" kept.
- [ ] **Step 4: Run `npm test`, expect PASS.** Then a scratch headless-Edge check: `/` on the AV computer shows 5 cards; with the loopback check off (or from a phone on the LAN), the PIN screen, then 2 cards.
- [ ] **Step 5: Commit** `feat: one-link web app shell with PIN, home, icons and new artwork`.

### Task 7: Mark attendance view (names and columns)

**Files:**
- Create: `web/app/mark.js`

**Interfaces:**
- Consumes: Task 6 ctx, Task 5 `/api/mark|unnamed|visitor|tap|zoom`.

- [ ] **Step 1:** Port the mockup's names view (sticky tiles, search, chips, groups, rows, stepper, unnamed, add visitor, finalized banner and lock) and its columns view (lanes, Zoom `− [n] +` stepper: digits only, 0–999, ↑/↓, locked when finalized). Every tap shows its change at once (optimistic), then follows the server state. Each mark sends a `newTapId()`.
- [ ] **Step 2: Verify with a scratch headless-Edge script:**
  - mark 6 KH (one household of 2) and 2 Zoom: totals 7 / 2 / 9;
  - the Zoom stepper gives `2`; typing `1a2b` gives `12`; ↑ gives `13`; 20 taps of − give `0`;
  - after Finalize, taps don't change the totals;
  - a person named `<img src=x onerror=alert(1)>` (Review Focus 5) shows as text, and no dialog opens;
  - light, dark and 390 px screenshots look like the mockup.
- [ ] **Step 3: Commit** `feat: mark attendance by name, or by column with the Zoom stepper`.

### Task 8: AV desk, History, Publisher list and setup, Settings views

**Files:**
- Create: `web/app/desk.js`, `web/app/history.js`, `web/app/list.js`, `web/app/settings.js`

**Interfaces:**
- Consumes: Task 5 AV-only and settings routes, Task 6 ctx.

- [ ] **Step 1: Desk.**
  - Totals, then Finalize: waiting art (`deskArt`), then the "Ready in M³" sheet (`deskArt({done:true})`) when `render.status` becomes `ready`.
  - v1 error and "Saved to Desktop" messages shown as Steward banners.
  - Unlock, Make the video again, Midweek/Weekend, New meeting (two taps within 4 s), Connect a phone (QR from `/api/connect`).
  - Must fit 320 px for the OBS dock.
- [ ] **Step 2: History.**
  - Date blocks and rows.
  - The detail view lists names from the entry's `people` snapshot: Kingdom Hall / Zoom (· n) / Not marked.
  - **Download for the circuit overseer** (`/api/history.xlsx`, with the PIN as a query) and **Download CSV (numbers only)**.
  - The empty state uses `historyArt`.
- [ ] **Step 3: List and setup.**
  - Setup: an empty state with `listArt`, Choose a file (posts raw bytes to `/api/roster/preview`), Type or paste names, Try made-up names, Blank template (`TEMPLATE_CSV` served as `/api/roster/template.csv`, AV-only).
  - Check the list: a sheet picker when there are several sheets (default: the most names), then **Use this list**.
  - When today has marks, confirm first with *"Today's marks will be cleared."*
  - Publisher list: groups with counts, Add a name, Remove (a confirm per person), Upload a new list, and the note "Past meetings don't change".
- [ ] **Step 4: Settings.** Everything in spec §6 Settings, through `/api/settings` and the host routes. Copy uses `navigator.clipboard.writeText`, with a fallback that selects the text. Update status polls `/api/settings` every 2 s while open.
- [ ] **Step 5: Verify with a scratch headless-Edge flow:**
  - the mockup's full test (upload a made-up 3-group xlsx, mark, finalize, history detail, xlsx and CSV download, Settings toggles);
  - light, dark and 390 px;
  - `/desk` at 320 px.
- [ ] **Step 6: Commit** `feat: AV desk, history with overseer export, publisher list and settings views`.

### Task 9: Electron uses the web app; remove old pages; release build

**Files:**
- Modify: `src/main.js`, `README.md`, `package.json` (version `0.3.0`)
- Delete: `src/renderer/` (index.html, app.js, preload.js), `web/count.*`, `web/dock.*`, `web/history.*`

**Interfaces:**
- Consumes: Task 5 `host`.

- [ ] **Step 1: Build the host.** `main.js` builds `host` from its existing pieces:
  - `saveSettings` applies the login item, `nativeTheme` (appearance) and `service.settingsChanged()`;
  - `chooseFolder` uses `dialog.showOpenDialog`;
  - `openFolder` uses `shell.openPath`;
  - updates come from `createUpdates`;
  - `version` is `app.getVersion()`.

  Then:
  - The window loads `http://127.0.0.1:<port>/`.
  - `setWindowOpenHandler` and `will-navigate` to non-app URLs open in the browser.
  - The tray menu's "Open the dock in the browser" goes to `/desk`.
  - Remove the IPC handlers that the routes replace.
- [ ] **Step 2: Verify.** `npm test` passes. Then `ATT_SHOT`: the window shows the home page. Then a scratch CDP click-through on the real Electron window: Settings → Appearance Dark recolours at once; Choose… opens the picker.
- [ ] **Step 3: Docs.** README: one link, names, the overseer workbook, privacy (names stay on the AV computer). `docs/hall-test-checklist.md`: add the names flow and the OBS dock address `/desk`.
- [ ] **Step 4: Build.** `npm run dist`. Check the asar has `web/app/`, has no `.xlsx`, and has `exceljs`. Run the packaged app once from a scratch data dir with v1 files copied in (Review Focus 1).
- [ ] **Step 5: Commit** `feat: desktop app opens the one-link web app; 0.3.0`. Don't publish the release; ask Caio.
