# Kingdom Attendance v2: attendance by name, one link, Settings (design)

Status: draft for Caio's approval · 2026-11-01 · builds on `2026-11-01-attendance-design.md` (v1)
Approved mockup: [`docs/preview/one-link/index.html`](../../preview/one-link/index.html). Open it in a browser; it reads Excel files in the browser only.

## 1. Why

The circuit overseer checks the attendance at every visit. Today that record is an Excel master file. There is one sheet
per meeting, listing every publisher by name with a number under **ZOOM** or **KINGDOM HALL**, and a
**SUMMARY (AVERAGE)** sheet with weekly totals and monthly averages. Caio: *"the publishers' names are so important: it
is important to know whether they are present in the KH or on Zoom."*

v1 counts heads by column (Left / Center / Right), so it can't produce that record. v2 lets attendants **mark each
person by name** on their phones, and produces the overseer's workbook in the same layout. The video stays numbers only.

v2 also fixes two things Caio found confusing in v1:
- **Too many links.** There were separate count, Zoom, dock and history pages. v2 has **one link and one QR code**.
- **Settings scattered in a tray window.** They move into the same app, redesigned in Steward.

## 2. Goals

1. Attendants mark each person **KH** or **Zoom** on a phone, with households counted (e.g. "Mark & Joy" = 2).
2. Each congregation **uploads its own list** (Excel or CSV). It is not tied to East-Tagalog. The list is kept until replaced or edited.
3. **One link / one QR code** opens a home screen. Every screen has **← Home**, so nobody jumps between links.
4. **History** shows each meeting by name. **Download for the circuit overseer** gives an `.xlsx` in the master file's layout.
5. **Nothing from v1 is lost** (see §9): every setting, Finalize / Unlock, the video, M³ delivery, updates and the CSV stay.
6. It looks like a Steward app, but with **its own identity**: its own artwork and palette (§7).

## 3. Non-goals (now)

- No automatic Zoom name reading (still needs a paid Zoom plan).
- No syncing with Google Sheets or OneDrive. The master stays where it is; the app *produces* a workbook.
- No editing of past meetings beyond what v1 allowed (Unlock today's meeting).

## 4. Anti-goals (a failure even if it "works")

- Names on the video, on the stage screen, in the GitHub repo or in logs.
- A phone being able to Finalize, Unlock, reset the meeting, or change settings.
- Slower than the sheet on a meeting night.
- Looking official (brand boundaries), or re-using other Steward apps' artwork.

## 5. Decided with Caio (don't reopen)

| Decision | Detail |
|---|---|
| Names replace column tapping | When a list exists, marking by name is the only counting. **Left / Center / Right stays** as the mode for congregations with **no list** (new users, or those who skip it) |
| Lists are per congregation | Upload Excel/CSV, paste names, or a blank template. Kept on the AV PC until a new upload or an edit |
| Past meetings never change | Each finalized meeting stores the names exactly as they were that day |
| One link | Home screen with cards. Phones land on it after the PIN. The Zoom host marks Zoom on the same list (no separate Zoom page) |
| AV-only actions | Finalize, Unlock, Make the video again, Midweek/Weekend, New meeting (two taps), Publisher list, Settings: **AV computer only** |
| Unlock flow (v1, kept) | Finalize locks phones. To fix a mark: AV desk → **Unlock** → fix → **Finalize** again (the new video replaces the old) |
| Zoom number in column mode | A **− [number] +** stepper. Digits only (0–999), ↑/↓ keys step it, never below 0 |
| Light by default | App appearance defaults to **Light**. Dark and Auto are opt-in (v1 0.2.x rule, kept) |
| Artwork | New, original artwork for this app (§7). The home menu uses **small icons, not artwork** |

## 6. Screens (as in the mockup)

**Home (`/`).** A header picture with the congregation name, meeting and date, and a Live/Finalized pill. Then Hall /
Zoom / Total tiles and the menu:
- **Mark attendance** (the main card): every device;
- **History**: every device;
- **AV desk**, **Publisher list**, **Settings**: AV computer only.

With no list on the AV computer, an "Add your publisher list" card leads to setup, or to **Count by Left, Center and
Right instead**.

**PIN (phones).** "Enter the PIN", then digits only. Wrong PIN: *"Wrong PIN. Check the number shown on the AV
computer."* The phone remembers the PIN (as v1). v1's brute-force limit (5 tries a minute) stays.

**Mark attendance, names mode.**
- Sticky: Hall / Zoom / Total, a search box, and filter chips: All · Not marked (n) · Kingdom Hall · Zoom.
- Groups in the list's order: each heading, then "n of N" marked.
- Row: name, then **KH** and **Zoom** (✓ when on; tapping again clears). Once marked, a **− n +** for the household size.
- After the list: **Unnamed visitors − n +** (counts toward the Hall) and **Add a visitor by name** with KH / Zoom.
- After Finalize: a "Finalized" banner and every control locked.

**Mark attendance, column mode.** The v1 lanes (Left / Center / Right) plus the Zoom stepper.

**AV desk (`/desk`, also the OBS dock).**
- Totals, Finalize, then "Making the video…" (waiting art), then the "Ready in M³" sheet.
- When finalized: Unlock and Make the video again, plus v1's status and error messages ("Saved to Desktop (…)",
  "Couldn't make the video…").
- Connect a phone (QR + PIN), Midweek / Weekend, and New meeting (two taps).

**History.**
- Rows show a date block (e.g. **28 OCT**), meeting type, Hall · Zoom and the total.
- **Download for the circuit overseer** (`.xlsx`) and **Download CSV (numbers only)**.
- The detail view lists each name: Kingdom Hall / Zoom (· n) / Not marked.

**Publisher list (AV).** Groups with counts, Add a name, Upload a new list, and the note "Past meetings don't change".

**Setup / Check the list (AV).**
- Upload or paste, then "n people found".
- With several sheets, "Which sheet is the list?", defaulting to the sheet with the most names.
- Groups with counts and the first names, then **Use this list**.

**Settings (AV).** All of v1's tray window, regrouped:
- **Attendance video:** congregation name, M³ shared folder (Choose… / Open) with the M³ help text, Video colours
  (Light/Dark), Open the videos folder.
- **Appearance:** Light / Dark / Auto.
- **Phones:** QR, PIN and New PIN; the one link (Copy / Open); the short name `attendance.local` (Copy / Open); the
  week-to-week note.
- **OBS dock:** the dock address (Copy / Open) and the 3 steps.
- **Start with Windows.**
- **Updates:** version, status, Check now, Restart and update, Update automatically.
- The independence notice at the bottom.

## 7. Look and feel

- **Steward:** `tokens.css` and the `st-` components, per `guidelines/` and `motion/motion.md`. Noto Sans, tap targets
  of 44 px or more (main actions 56), colour never the only signal (✓ on marks, words on pills).
- **Own artwork,** `web/shared/attendance-art.js` (from `docs/preview/one-link/attendance-art.js`).
  - It uses the same language as Steward: duotone, halftone dots, big circles, people from behind.
  - Its palette is its own: slate `#1e3a4c`, terracotta `#d9775a`, sand `#f6e8d6`, paper `#fffaf2`, and Steward
    teal `#2f7f86` for Zoom.
  - The pieces:
    - `attendanceHeroArt`: home header;
    - `markArt`: PIN screen;
    - `listArt`: setup and "add your list";
    - `historyArt`: empty History;
    - `deskArt`: waiting and "Ready" (`done: true`).
  - `remoteArt` (the video's Zoom art) stays on the Zoom stepper card.
  - It needs `halftone()` from Steward's `art.js`.
- **Art placement:** only at the edges of a task (welcome, empty, waiting, done). Never on menu cards, never behind
  numbers. The home menu uses **24 px line icons** in Steward's style, in a 44 px soft-blue tile (solid blue for the
  main card).
- **Motion:** arrive / wait / celebrate / rest exactly as Steward defines them, with reduced motion respected.
- The video keeps its v1 light look and art. Only the app UI changes.

## 8. Data and privacy

- **List:** `publishers.json` in the app data folder (the Electron `userData`), as `[{id, name, group, size}]`.
  - Ids are stable, so marks survive edits.
  - Never sent anywhere. Not in git: `*.xlsx` is already excluded locally, and test fixtures use made-up names.
- **Meeting** (`current.json`, v1's atomic saves): `marks: {id: {where: 'kh'|'zoom', n}}`, `unnamed`, plus v1's
  `lanes` and `zoom` for column mode.
- **History** (`meetings.json`): each finalized meeting stores a **snapshot of the names it used**, so later list
  changes don't alter it. Re-finalizing replaces that day's entry (v1 rule).
- **Who sees names:** only devices that passed the PIN (or the AV computer). Phones keep no copy of the list (no
  browser storage of names). Names never reach the video renderer.
- **Import rules** (from the mockup, tested on the ETC sheet: 109 people, groups Publishers 70 / CLMS 4 /
  JW VISITORS ZOOM / KH 6 / INVITED THRU ZOOM 29):
  - A template with a `Name` column (optional `Group`) is read directly.
  - Otherwise names are read from the first filled column, starting after a "PUBLISHER(S)" heading row if there is one.
  - A capitalised line containing CLMS / VISITOR / INVITED / GUEST / STUDENT / GROUP / PUBLISHERS / INTERESTED starts a
    new group.
  - Rows starting "Total…" are skipped, and reading stops at "SUB-TOTAL" / "TOTAL".
  - Names with `&`, `/`, " and " or " - " start at household size 2.
- **Overseer workbook:**
  - One sheet per finalized meeting, named `WEEKEND MEETING (Nov 01)`: the title row, then
    `PUBLISHER | ZOOM | KINGDOM HALL`, then groups in list order, Unnamed visitors, `SUB-TOTAL` (Zoom, Hall) and
    `TOTAL`.
  - Then `SUMMARY (AVERAGE)`: one row per meeting (date, meeting, Zoom, In-Person, Total), plus monthly and per-type
    averages over **meetings that took place only**. Weeks with no meeting count as nothing, never as 0.
  - Column mode meetings export Left/Center/Right and the Zoom total instead of names.

## 9. Nothing lost from v1 (checklist)

Counting, the live updates (SSE), tap de-duplication, PIN with its rate limit, Finalize / Unlock / Make the video again,
render status and errors, M³ delivery with Desktop fallback, Midweek / Weekend, New meeting, History and the CSV,
congregation name, M³ folder, Video colours, Open the videos folder, Appearance, the QR code, PIN and New PIN, links with
Copy / Open, the short name and its live re-announce, OBS dock steps, Start with Windows, the tray menu (Open / Open the
dock / Quit with confirm), Updates (0.2.0), the independence notice.

**Old addresses keep working.** `/count`, `/zoom` and `/history` redirect to `/` (`/history` → History), and `/dock` →
`/desk`, so an OBS dock already set up doesn't break.

## 10. My calls (Claude), for Caio to check

1. **A visitor added during a meeting** counts for that meeting only. The AV computer can add them to the list
   permanently from Publisher list. *(Caio didn't answer this one yet; easy to change.)*
2. **Two phones marking the same person:** the last tap wins. Every phone shows the change live.
3. **Settings move from the tray window into the web app** (AV computer only). The Electron window simply opens the home
   page. "Choose…" asks the Electron app to show the folder picker, allowed only from the AV computer itself.
4. **AV-only is decided by "is this request from the AV computer itself"** (v1's loopback check), not by a second PIN.
5. Version **0.3.0**, published as an update through the 0.2.0 auto-updater.
6. **Editing the list during a meeting:** today's marks follow the stable ids. A removed person's mark is dropped from
   today's meeting. Uploading a whole new list mid-meeting asks first ("Today's marks will be cleared").

## 11. Left to the builder

- Splitting `web/` into one app page with views versus several pages behind one home (the user experience must match the
  mockup either way).
- The `.xlsx` library on the AV PC (it must write the layout above; check licence and audit status).
- How `/desk` fits the narrow OBS dock (it must stay usable at about 320 px wide).
- Test structure. Required: import parser cases (the ETC layout, the template, pasted text, empty and odd files), marks
  and totals, history snapshot immutability, workbook layout, redirects, AV-only refusals from a non-loopback address,
  and headless Edge screenshots (light, dark, phone width).
