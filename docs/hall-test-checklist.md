# Hall test checklist

Run this on the real AV computer before the first live meeting. It takes about 20 minutes.
Tick each box and note anything odd.

## 0. The publisher list

- [ ] On the AV computer: **Add your publisher list** → upload the congregation's master attendance sheet (.xlsx). The count and groups shown match the sheet (publishers, CLMS, visitors, invited through Zoom). Pick the most recent meeting sheet if asked.
- [ ] Households such as "Marian & Bong" start at 2; fix any that shouldn't on the phone with − / +.
- [ ] The OBS dock uses `http://localhost:4590/desk` (an old `/dock` dock still works: it is redirected).

## 1. M³ and OBS (needs the hall setup)

- [ ] M³: **Settings → Integrations → Shared folder → "Add media from a shared folder"** is on, and Kingdom Attendance points at the same folder.
- [ ] Mark a few names and press **Finalize** in the OBS dock. The dock says **Ready in M³** within about 30 s.
- [ ] The video appears in **today's** meeting list in M³ **without restarting M³**. If it needs a refresh, write down how.
- [ ] Clicking it in M³ plays it on the hall monitor, and the picture is sharp.
- [ ] OBS shows it to Zoom, smooth and readable on a Zoom participant's screen.
- [ ] When the video ends, M³ either holds the total or goes back to its usual screen. Write down which.
      If it goes black too soon, the still image (`.png`) can be shown instead.

## 2. Two phones at once

- [ ] Two phones on the hall Wi-Fi open the QR link (or the IP link) and enter the PIN. Each sees only **Mark attendance** and **History**.
- [ ] Marking a name on one phone updates the other within about a second.
- [ ] Each tap counts exactly once; the same person marked on both phones counts once (the last tap wins).
- [ ] The Zoom host marks Zoom names from Zoom's participant list on a phone, and the Zoom total matches.
- [ ] **History → Download for the circuit overseer** opens in Excel with every name under ZOOM or KINGDOM HALL.

## 3. Wi-Fi drop

- [ ] On one phone, turn Wi-Fi off. The page says **Reconnecting…** and the buttons are greyed out.
- [ ] Turn Wi-Fi back on. It goes back to **Live** with the right numbers, and nothing was counted twice.

## 4. Restart mid-count

- [ ] Mark some names, then restart the AV computer.
- [ ] Kingdom Attendance starts by itself in the tray, and the marks are the same as before.
- [ ] After updating from 0.2.x, the old History is still there with its numbers.

## 5. Timing

- [ ] From pressing **Finalize** to **Ready in M³**: ____ seconds. It should be under 30 s; on the development laptop it was 12–15 s. The first video after the app starts can take longer, so time both a first and a second Finalize.

## Checked on the development laptop (2026-11-01)

These were checked before the hall test, so the list above only repeats what needs the real hall:

- The MP4 is 1920×1080, H.264, 30 fps, 12.0 s, and decodes cleanly. It wasn't tested in M³ itself.
- Finalize copies it to `<shared folder>\2026-11-01\` and the dock says "Ready in M³". With no folder set, it says "Saved to Desktop (M³ folder not set)".
- 100 taps from two clients at once all counted; a repeated tap counted once; a restart kept the numbers. These are automatic tests.
- The counting page, dock, Zoom page, history and settings window were checked in screenshots at phone and desktop widths.

Added for 0.3.0 (names, one link):

- The master sheet's layout reads correctly (109 people, its four groups; the SUMMARY sheet gives no names). Automatic tests cover the layout, the template, pasted names and bad files.
- Marking by name, households, unnamed visitors, added visitors, the Finalize lock, History with names and both downloads, the publisher list and Settings were checked in a browser at 320 and 390 px, light and dark. The OBS dock fits 320 px.
- In the desktop app: Finalize shows "Making the video…" then "Ready in M³", and the MP4 lands in the shared folder's dated subfolder.
- Phones get "Only on the AV computer." for Finalize, Unlock, the list and Settings, with or without the PIN (automatic tests).
