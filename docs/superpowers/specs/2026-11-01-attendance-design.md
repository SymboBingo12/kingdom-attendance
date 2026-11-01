# Kingdom Hall Attendance: design

Date: 2026-11-01 · Owner: Caio (SymboBingo12) · Status: draft for Caio's approval

## 1. Why

Today attendance takes several manual steps, all done near the end of the meeting:

1. Attendants count the hall and someone counts Zoom, then type both into a Google Sheet.
2. The numbers are typed by hand into a pre-built Canva template.
3. The slide is downloaded, then uploaded into M³ (Meeting Media Manager).
4. M³ shows it on the hall monitor; OBS captures that and sends it to Zoom.

The slow part is everything after counting: the sheet, Canva, download, upload.
The count itself also drifts, because it starts from a "fixed" publisher number that goes wrong whenever publishers can't come.

**Goal:** cut the manual work to *count heads on a phone, type one Zoom number, click once*.
It doesn't need to be perfect or fully automatic, but it must work every week.

## 2. Goals, non-goals, anti-goals

**Goals**
- Count the hall from a phone, by column: **Left, Center, Right**. Tap counters, no typing.
- Enter the Zoom number in one field.
- Totals add themselves up live on every device.
- **Finalize** makes a short animated attendance video (plus a still PNG of its last frame) and puts both where M³ picks them up. Canva is gone.
- Keep a history of every meeting (date, midweek/weekend, columns, Zoom, total) and export it to CSV.
- Look, install and connect like Stage Timer: tray app on the AV PC, QR code and PIN for phones, an OBS dock.

**Non-goals (v1)**
- No names, no list of publishers, no record of who sat where. Numbers only.
- No automatic Zoom count (see 6, later).
- No cloud and no internet access. Everything stays on the hall Wi-Fi.
- Not part of Stage Timer. It is a separate app (Caio's decision).

**Anti-goals: failure even if it technically works**
- The slide isn't ready before the closing song ends.
- An attendant needs training beyond "scan, enter PIN, tap +".
- A phone or Wi-Fi hiccup loses the count.
- Personal data about members is stored.
- It looks or sounds official (JW.ORG / JW Library logos, names, fonts or art).

## 3. How it's used (the meeting, step by step)

Hall layout: three columns (Left, Center, Right). AV desk is at the back left; attendants are at the back right.
Seating is free.

| When | Who | What they do |
|---|---|---|
| Before the meeting | AV | The app is already running in the tray (it starts with Windows). Nothing to do. |
| Any calm point in the 2 hours | Attendant(s), back right | Scan the QR code, enter the PIN, tap **+** for each person in a column. One person can do all three columns, or two or three people can each take one; their phones stay in sync. **−** undoes a mistake. |
| Any time | Zoom host (AV desk or own phone) | Adds up the "(n)" numbers in participants' Zoom names and types the total in **Zoom**. |
| End of the meeting approaches | AV | Checks the summary, presses **Finalize**. |
| Before the closing song ends | AV | Plays the slide in M³ (one click). The hall monitor shows it; OBS carries it to Zoom as today. |

Last-minute arrivals are rare, so the count isn't expected to change after Finalize.
**Unlock** is there if it's ever needed: edit, then Finalize again, which overwrites the slide.

Summary the AV sees:

```
Hall   Left 34 · Center 41 · Right 29   = 104
Zoom                                     =  23
TOTAL                                    = 127   [ Finalize ]
```

## 4. Pages and screens

| Page | Who | Content |
|---|---|---|
| `/count` | Attendants (phone) | Three big lanes (Left / Center / Right), each with a large **+**, a smaller **−** and the lane's number. Hall total at the top. Big enough to hit without looking, with no zoom or text selection on long-press. |
| `/zoom` | Zoom host | One number field plus a "Saved" confirmation. Also shown as a section on `/dock`. |
| `/dock` | AV, inside OBS (Custom Browser Dock) | The summary above, the Zoom field, meeting type (midweek/weekend, picked from the weekday, with an override), **Finalize** / **Unlock**, **New meeting** (resets to 0), the connect QR and PIN. |
| `/slide` | Rendering only | The attendance slide in HTML; the app captures it as a PNG. |
| `/history` | Anyone on the PC | Table of past meetings and **Download CSV**. |
| Tray window | AV | Links, QR code, PIN, settings (M³ folder, port, name). |

Phones use the PIN; the PC itself (localhost) doesn't need one, the same as Stage Timer.

## 5. The attendance presentation (replaces the Canva template)

The current Canva template ("Midweek Attendance Report", 6 pages) tells the result in four beats over that week's featured meeting picture:
intro ("Meeting Attendance", congregation name, Midweek/Weekend) → Kingdom Hall number → Zoom tie-in number → Total, with Hall and Zoom shown beneath it.
It shows **only Hall, Zoom and Total**. Columns and publisher/visitor numbers are not shown.

**Decision (Caio, option 3):** our own built-in template, **the same every week**, in the Steward design, with **no featured meeting pictures**.
- Why no pictures: choosing one each week brings back a manual step, and the pictures are the organisation's artwork (Kingdom rule: original art only, never official). The app never downloads or bundles them.
- Later (not v1): an optional "background picture" box the AV may fill by hand. Empty means the uniform design.

**The video**, about 10–12 s, 1920×1080, the same four beats:
1. Intro: "Meeting Attendance", congregation name (a setting), Midweek/Weekend, date.
2. Kingdom Hall: the number counts up.
3. Zoom: the number counts up.
4. Total: the number lands with Hall and Zoom beneath it, then **holds**. The last 2–3 s are still, so the screen rests on the result.

- Look: professional, minimalist and calm. Steward tokens and type, motion per `kingdom-project-design/motion/motion.md` (no flashy effects). Readable from the back of the hall and on a Zoom thumbnail.
  **Light (Caio, 2026-11-01: "this is a presentation").** White page, ink text, coral eyebrows, brand-blue rings. This overrides Steward's "stage screens are always dark" rule, which is meant for timers.
- **Motion must feel smooth (Caio):**
  - Elements arrive over 0.8 s, with ease-out-quart and a 20 px rise.
  - Beats crossfade over 0.5 s (ease-in-out), starting 0.3 s before each boundary.
  - Numbers count up over 1.8 s, starting 0.3 s into their beat.
  - Art circles drift up to 3 % larger across their beat.
  - Reference: the approved preview, `docs/preview/attendance-video-preview.html`.
- How it's made: the `/slide` page draws any moment of the animation from the finalized numbers and a time `t`, so the animation is deterministic and testable.
  On **Finalize**, Electron renders it in a hidden 1920×1080 window and writes an **MP4 (H.264)**, the format M³'s guide recommends.
  Builder's first spike picks the encoder:
  (a) Chromium `MediaRecorder` with `video/mp4;codecs=avc1`, if Electron's build supports it (no extra binary), or
  (b) frame-by-frame capture piped to a bundled `ffmpeg-static` (reliable; ship ffmpeg's licence next to it).
  A still **PNG of the final frame** is saved too, as a backup and for history.
- The AV sees a "Making the video… / Ready" state on the dock. It must be ready within about 30 s of Finalize.
- File names: `Attendance YYYY-MM-DD Midweek.mp4` and `.png`. The video goes to the M³ shared folder's date subfolder (see below); both files go to the app's own `slides/` folder.
- The same `/slide` page also works as a live **OBS browser source** (`/slide?live=1`) as a no-file fallback.

### Getting the slide into M³

- **v1, confirmed in M³'s user guide:** M³ has **Settings → Integrations → Shared folder → "Add media from a shared folder"**.
  M³ creates a subfolder per meeting named by date (`YYYY-MM-DD`). Files put in a meeting's folder are **added to that meeting's media list automatically**.
  A missing date folder can be created with the same name.
  So the app writes the video to `<M³ shared folder>/<today YYYY-MM-DD>/`, creating the date folder if needed. It shows up in M³ by itself and the AV clicks it.
- One-time setup at the hall: turn that M³ setting on (if it isn't already) and paste the same folder into the app's Settings. If the hall already uses it with a cloud folder (Dropbox or OneDrive), just point the app at that folder.
- M³'s "Delete past meeting folders" may clear old weeks. That's fine, because the app keeps its own copy in `slides/`.
- Fallback, if the folder isn't set: the video is saved to the Desktop for one drag-and-drop into M³.
- **Later (optional):** a Stage Countdown–style hand-off. The app hides M³'s media window, shows the slide fullscreen on the hall monitor, then gives the screen back. That removes even the M³ click, but it is Windows-specific and fragile, and Stage Countdown's own notes say it is still untested on a real rig. Only worth it once v1 is proven.

## 6. Zoom count

- **v1:** a number someone types. They add up the "(n)" numbers in participants' Zoom names. About 30 seconds.
- **Later (optional):** read the live participant list from the Zoom API and add up the "(n)" numbers automatically.
  This needs the Zoom account owner to create a Server-to-Server OAuth app, and live participant data needs a paid plan (dashboard metrics usually need Business).
  Even then, names without "(n)" have to be guessed as 1. Not in v1.

## 7. How it's built (builder's notes)

Follows **Stage Timer** (gsgian, MIT), used as a *reference only*: same shape, written fresh, and no code copied without keeping gsgian's copyright notice.

- **Runtime:** Electron tray app (Windows installer via electron-builder and GitHub Actions on a tag), plus `npm run serve` for headless testing.
- **Server:** Node `http` on the AV PC, port **4590** (fallback 4591). Port 80 and 4580 belong to Stage Timer; 4578 belongs to Stage Countdown.
  mDNS name `attendance.local`; the IP link is shown too, for Wi-Fi that blocks discovery.
- **Live sync:** Server-Sent Events (`/api/events`), as in Stage Timer. Every change is a small POST (`/api/count` with `{lane, delta}`, `/api/zoom` with `{value}`, `/api/finalize`, `/api/unlock`, `/api/new`).
  The server is the only source of truth, and phones just show what it sends back. Taps are deltas, so two phones tapping the same lane never overwrite each other.
- **Never lose the count:** the state is written to disk (atomic write) after every change. If the app or PC restarts mid-meeting, it comes back with the same numbers.
  If a phone drops off Wi-Fi it shows "Reconnecting…" and blocks taps, so no taps are silently lost.
- **Data:** `meetings.json` in the app data folder (no names). CSV export from `/history`.
- **Security:** PIN for anything not on localhost; local network only; nothing leaves the building.
- **Look:** Steward tokens and `st-` components; follow `kingdom-project-design/guidelines/` and `motion/motion.md`; phone polish per the mobile-native rules.
- **Tests:** `node --test` for the counting logic, finalize/unlock and the API (tapping from two clients at once, restart recovery). Headless Edge screenshots of `/count`, `/dock` and `/slide` in light, dark and phone width.
- **README:** independence notice (not affiliated with or endorsed by any organisation), MIT, Caio as copyright holder.

## 8. Decided by Caio

- Separate app, not inside Stage Timer (for now). Stage Timer and Stage Countdown are references.
- Count the hall by heads, in three columns; seats are free. No fixed publisher number.
- Zoom: people rename themselves with "(n)"; someone adds them up.
- Attendance is finalized near the end of the meeting and must be on screen before the closing song ends.
- The slide reaches the screens through M³ (hall monitor), and OBS carries it to Zoom.
- Phones are the counting device. Reducing manual work is enough; full automation is not required.

## 9. Answered by Caio (2026-11-01)

1. **Slide:** option 3, our own uniform Steward template, animated like the Canva one, with no weekly pictures (section 5).
2. **Publishers vs visitors:** not needed. The template shows only Hall, Zoom and Total, so one **+** per column.

**Checked 2026-11-01:** M³'s shared-folder feature exists (section 5). Video format: MP4, per M³'s own guide.
**Still to check on the hall PC:** that the MP4 plays in M³'s media window and that the date-folder file appears in that meeting's list.

## 9b. Small calls made by Claude (Caio can overrule)

- **Automatic reset:** on the first tap of a new day, the counters start from 0 for the new meeting. The previous day's numbers stay in history. Nobody has to remember **New meeting**, which remains for a manual reset.
- **Steward files are copied into the app** (tokens and the `st-` components it uses), because an installed app can't read the sibling folder. Recopy them when Steward changes.
- **Releases:** the build makes a local installer. A GitHub repo, a public release or auto-updates only happen when Caio says so.
- **Two people on one column:** every phone shows each column's live number, so double-counting is easy to spot. No locking of columns.

## 10. Left to the builder

Exact UI wording (Caio's voice guidelines), the slide composition within Steward, file and folder layout, error messages, and how the dock fits OBS's dock widths.

## 11. After approval

1. Implementation plan (`superpowers:writing-plans`).
2. The **build skill** `kingdom-attendance-build`: this design, the plan, the M³/OBS/Zoom notes and the gotchas, so any later session can continue the build without re-exploring.
3. `/new-project` in this folder (CLAUDE.local.md, STATUS.md, CONTEXT.md), git init, then build on a branch.
