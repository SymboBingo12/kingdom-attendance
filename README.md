# Kingdom Hall Attendance

Count the meeting attendance on phones, then show it as a short video on the hall monitor and on Zoom.

It replaces the old routine: marking names in a spreadsheet, typing the numbers into Canva, downloading the slide, and uploading it to M³.
Now everyone opens **one link**. Attendants mark each person **KH** or **Zoom** on their phones, and the AV desk presses **Finalize**.
The app makes a 20-second attendance video and drops it into M³ by itself, and keeps the names for the circuit overseer's report.

> An independent project. Not affiliated with or endorsed by any organisation. It uses original artwork only.

## How it's used at a meeting

| Who | What they do |
|---|---|
| **Attendants** (back of the hall) | Scan the QR code, enter the PIN, open **Mark attendance**, and tap **KH** beside each person present (**− / +** for a household; tap again to clear). Search and **Not marked** help find who's left. Unnamed visitors have a counter; a visitor can be added by name. Several phones can mark at once; they all show the same list. |
| **Zoom host** | Same link: taps **Zoom** beside the names on Zoom. |
| **AV desk** | Near the end of the meeting, opens **AV desk** (or the OBS dock) and presses **Finalize**. After a short wait it says **Ready in M³**. Click the video in M³ before the closing song ends. Marks can still change after that: a change overwrites the meeting's record in History, and the desk asks you to press **Update the video**. |

Without a publisher list the app counts by column instead: **Left / Center / Right**, and the Zoom host types the total with a **− [n] +** stepper.

The count is saved after every tap. If the computer restarts, the marks are still there.
The first tap on a new day starts a fresh meeting. Every finalized meeting is kept in **History** with the names as they were that day, and **Download for the circuit overseer** gives an Excel file in the attendance-sheet layout (one sheet per meeting, plus a summary with monthly averages). A numbers-only CSV is there too.

## One-time setup on the AV computer

1. **Install.** Run `Kingdom-Hall-Attendance-Setup-<version>.exe`. The installer isn't code-signed, so Windows SmartScreen will warn you; choose **More info → Run anyway**.
   The app lives in the tray and starts with Windows. Its window is the same app the phones use, with the AV-only parts added.
2. **Publisher list.** On the home screen, **Add your publisher list**: upload the attendance sheet (.xlsx) or a CSV, or paste names. Check what was read, then **Use this list**. Change it any time under **Publisher list**.
3. **Settings → Attendance video.** Type the congregation name (it appears on the video).
4. **M³.** In M³, open **Settings → Integrations → Shared folder** and turn on **"Add media from a shared folder"**.
   Choose a folder, then choose the **same folder** in Kingdom Hall Attendance (**Settings → M³ shared folder → Choose…**).
   The app puts each video in that folder's `YYYY-MM-DD` subfolder, and M³ adds it to that meeting's media list.
   If no folder is set, the video is saved to the Desktop for you to drag into M³.
5. **OBS dock.** In OBS, open **View → Docks → Custom Browser Docks…**, name it `Attendance` and use the URL `http://localhost:4590/desk` (also shown under **Settings → OBS dock**).
6. **Phones.** Show the QR code (**Settings → Phones** or **AV desk**). Phones must be on the hall Wi-Fi.

## Addresses

| Address | For |
|---|---|
| `/` | The one link: Home, Mark attendance, History; on the AV computer also AV desk, Publisher list and Settings |
| `/desk` | The OBS dock (opens the AV desk) |
| `/slide` | The attendance video page. `?live=1` also works as an OBS Browser Source that replays when attendance is finalized. |

The v1 addresses `/count`, `/zoom`, `/dock` and `/history` still work and lead to the new ones.

## Links, ports and privacy

- The app announces itself as `attendance.local` on port **4590** (or 4591 if that's taken). It uses neither Stage Timer's port 80/4580 nor Stage Countdown's 4578.
  The QR code and links use the PC's IP address, because many Android phones can't open `.local` names. The address can change from week to week, so scan the QR code again if a saved link stops working.
- **Names are kept on the AV computer and, if the congregation connects one, in its Google account.** The publisher list and each meeting's marks are saved in the app's data folder on the AV computer. With **Google Sheets** connected (below), the names are also written to two spreadsheets in that Google account, so connect only an account the congregation has agreed to. Names never appear on the video, never go into this repository, and are shown only to phones that entered the PIN. Phones keep no copy.
- Phones need the 4-digit PIN; the AV computer itself doesn't. Five wrong PINs in a minute block that phone for a minute. Finalize, Update the video, the list and Settings work only on the AV computer.
- The only internet requests are the update check against this project's GitHub releases (**Settings → Updates**; it can be switched off) and, only if Google Sheets is connected, the sync to Google.

## The video

20 seconds, 1920×1080, MP4 (H.264), light Steward design:

1. **Intro:** Meeting Attendance, congregation, Midweek or Weekend, and the date.
2. **Kingdom Hall:** the number counts up.
3. **Zoom:** the number counts up.
4. **Total:** the total, with both parts, held on screen.

**Announce cleaners** (Settings, off by default) changes the last slide: the total with the Kingdom Hall and Zoom numbers on the left, and the field service groups assigned to clean the restrooms and the hall on the right. Set the groups before pressing Finalize.

A still image of the last frame is saved next to it (tray → *Open Kingdom Hall Attendance* → *Open the videos folder*).

## Google Sheets (optional)

**Settings → Google Sheets → Connect Google** signs in once and creates two spreadsheets in that account:

- **Attendance | <Congregation>**: a *Weekend Meeting* and a *Midweek Meeting* tab (every name with Zoom or Kingdom Hall, then the totals) and a *Service Year Record* tab with the numbers for every meeting and the monthly averages.
- **Log for Attendance | <Congregation>**: a *Weekend Meeting* and a *Midweek Meeting* tab with a row per person and a column per meeting date.

It updates after every finalized meeting. A change made after finalizing overwrites that meeting's rows, and the desk asks you to update the video. If the hall has no internet the meeting waits and is sent later.
On a new computer or account, **Connect Google** first looks for sheets the app already made in that account and asks **Use the existing sheets?** before creating anything.
Every September 1 the Log starts fresh tabs for the new service year; the old ones are kept, renamed with their year.
The app asks Google only for the narrow *drive.file* permission, so it can reach the sheets it created and nothing else in the Drive. The sign-in token is kept in the data folder on the AV computer.

Whoever builds the app needs a Google Cloud OAuth client ("Desktop app"). The ID and secret are not kept in git: put them in `src/core/google/config.local.js` (git-ignored, `module.exports = { clientId, clientSecret }`) or set `KA_GOOGLE_CLIENT_ID` and `KA_GOOGLE_CLIENT_SECRET`.
The release workflow writes that file from the repository secrets of the same names.

## Before the first live meeting

Run [docs/hall-test-checklist.md](docs/hall-test-checklist.md) on the real AV computer.

## Updates

The installed app updates itself from this project's GitHub releases (`SymboBingo12/kingdom-attendance`).
It checks 15 seconds after it starts and then every 6 hours. A new version downloads in the background and is installed when the app is quit, or when someone presses **Restart and update** in the window. It never restarts by itself, and it won't restart while the video is being made. **Update automatically** can be turned off in the window.

To publish a new version: raise `version` in `package.json`, merge, then push a tag such as `v0.4.0`. The *Windows installer* workflow builds it and uploads it to a draft GitHub release; publish that draft and installed apps update. (By hand: `npm run dist -- --publish always` with a `GH_TOKEN` that can write to the repository.) Phones need nothing: they load the pages from the AV computer.

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
