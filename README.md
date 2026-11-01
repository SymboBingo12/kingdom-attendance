# Kingdom Attendance

Count the meeting attendance on phones, then show it as a short video on the hall monitor and on Zoom.

It replaces the old routine: counting into a Google Sheet, typing the numbers into Canva, downloading the slide, and uploading it to M³.
Now attendants tap **+** on their phones. Someone types the Zoom number, and the AV desk presses **Finalize**.
The app makes a 12-second attendance video and drops it into M³ by itself.

> An independent project. Not affiliated with or endorsed by any organisation. It uses original artwork only.

## How it's used at a meeting

| Who | What they do |
|---|---|
| **Attendants** (back of the hall) | Scan the QR code, enter the PIN, then tap **+** for each person in **Left**, **Center** and **Right**. **−** undoes a mistake. Several phones can count at once; they all show the same numbers. |
| **Zoom host** | Adds up the numbers in people's Zoom names ("Cruz (4)" counts as 4) and types the total on `/zoom` or in the OBS dock. |
| **AV desk** | Near the end of the meeting, checks the totals in the OBS dock and presses **Finalize**. About 15–30 seconds later the dock says **Ready in M³**. Click the video in M³ before the closing song ends. |

The count is saved after every tap. If the computer restarts, the numbers are still there.
The first tap on a new day starts a fresh count, and every finalized meeting is kept in **History**, with a CSV download.

## One-time setup on the AV computer

1. **Install.** Run `Kingdom-Attendance-Setup-<version>.exe`. The installer isn't code-signed, so Windows SmartScreen will warn you; choose **More info → Run anyway**.
   The app lives in the tray and starts with Windows.
2. **Congregation name.** In the app window, type it under *Attendance video*. It appears on the video.
3. **M³.** In M³, open **Settings → Integrations → Shared folder** and turn on **"Add media from a shared folder"**.
   Choose a folder, then choose the **same folder** in Kingdom Attendance (*M³ shared folder → Choose…*).
   The app puts each video in that folder's `YYYY-MM-DD` subfolder, and M³ adds it to that meeting's media list.
   If no folder is set, the video is saved to the Desktop for you to drag into M³.
4. **OBS dock.** In OBS, open **View → Docks → Custom Browser Docks…**, name it `Attendance` and use the URL `http://localhost:4590/dock`.
5. **Phones.** Print or show the QR code from the app window. Phones must be on the hall Wi-Fi.

## Pages

| Page | For |
|---|---|
| `/count` | Attendants' counting page (PIN needed on phones) |
| `/zoom` | The Zoom host's number, on a phone |
| `/dock` | The OBS dock: totals, Zoom number, Finalize, Unlock, Make video again, Connect a phone, History, New meeting |
| `/history` | Every finalized meeting, with a CSV download |
| `/slide` | The attendance video page. `?live=1` also works as an OBS Browser Source that replays when attendance is finalized. |

## Links, ports and privacy

- The app announces itself as `attendance.local` on port **4590** (or 4591 if that's taken). It uses neither Stage Timer's port 80/4580 nor Stage Countdown's 4578.
  The QR code and links use the PC's IP address, because many Android phones can't open `.local` names. The address can change from week to week, so scan the QR code again if a saved link stops working.
- **Numbers only.** No names or personal details are stored. Nothing leaves the hall network: the app makes no internet requests.
- Phones need the 4-digit PIN; the AV computer itself doesn't. Five wrong PINs in a minute block that phone for a minute.

## The video

12 seconds, 1920×1080, MP4 (H.264), light Steward design:

1. **Intro:** Meeting Attendance, congregation, Midweek or Weekend, and the date.
2. **Kingdom Hall:** the number counts up.
3. **Zoom:** the number counts up.
4. **Total:** the total, with both parts, held on screen.

A still image of the last frame is saved next to it (tray → *Open Kingdom Attendance* → *Open the videos folder*).

## Before the first live meeting

Run [docs/hall-test-checklist.md](docs/hall-test-checklist.md) on the real AV computer.

## Build from source

Requires Node.js 22 or later.

```bash
npm install
npm test          # unit and API tests
npm run serve     # server only, no video (http://localhost:4590/count)
npm start         # the desktop app
npm run dist      # Windows installer in release/
```

When Electron is started from inside VS Code, clear `ELECTRON_RUN_AS_NODE` first (VS Code sets it).

```
src/core/     meeting rules, saving, settings, server, M³ delivery
src/render/   the video renderer (Electron + ffmpeg)
src/main.js   tray app and settings window
web/          counting page, dock, history, the video page; Steward files in web/steward/
test/         tests
```

## Credits and licence

- Design: the Steward design system (Caio, MIT). Artwork is original and drawn in code.
- Font: Noto Sans, SIL Open Font License 1.1 (`web/steward/fonts/OFL.txt`).
- Video encoding: FFmpeg via `ffmpeg-static`. Its licence ships with the app under `LICENSES/`.
- Shaped after Stage Timer (by gsgian) and Stage Countdown (by Gi), used as references; no code copied.

Released under the [MIT licence](LICENSE). © 2026 Caio (SymboBingo12).
