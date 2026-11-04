# Changelog

## 0.5.2 · 2026-11-04

### Added
- **Connect button.** The AV desk header and the sidebar have a **Connect** button that opens a popup with the large QR code and PIN for phones.
- **Connect a phone in the tray menu.** Right-click the app's tray icon (or the Dock icon on a Mac) and choose **Connect a phone (QR code)** to open a small window with the QR code and PIN, without opening the app first.

## 0.5.1 · 2026-11-04

### Changed
- **Finalize asks who the cleaners are.** With Announce cleaners on, pressing **Finalize** (or **Update the video**) first asks which field service group (FSG 1 to 5) cleans the restrooms and which cleans the hall.
  "FSG" is built in, so only the number is chosen; the choice is saved with that meeting. Settings keeps the on/off switch and the hall's name on the slide.
- **Cleaners slide icons.** The restrooms use the standard restroom sign and the hall a row of chairs.

## 0.5.0 · 2026-11-04

### Added
- **Announce cleaners (optional).** **Settings → Cleaners on the video**: when on, the video's last slide shows the attendance total with the Kingdom Hall and Zoom breakdown on the left,
  and the field service groups assigned to clean the restrooms and the hall on the right. Type the groups (for example `FSG 2`) before pressing **Finalize**; a group left empty is not shown.

## 0.4.1 · 2026-11-03

### Fixed
- **Clearer Google sign-in error.** When Google rejects the app's client ID or secret (`invalid_client`), the app now says so instead of showing a message that looked like an expired sign-in.

## 0.4.0 · 2026-11-03

### Added
- **Publisher list groups.** The list now has **Publishers**, **Unbaptized publishers** and an **Invited** section.
  Invited entries take a name or family group, how many they are, and Kingdom Hall or Zoom. Adding one also marks it for today's meeting.
- **New CSV template.** The blank template has `Publishers` and `Unbaptized publishers` columns. The old `Name,Group` format still imports.
  Capitalised `UNBAPTIZED PUBLISHERS` and `INVITED` lines in pasted lists and Excel files start the matching groups.

### Added (Google)
- **Google Sheets sync.** **Settings → Google Sheets → Connect Google** writes every finalized meeting to `Attendance | <Congregation>` and `Log for Attendance | <Congregation>`.
  Later changes overwrite the meeting's rows; offline meetings wait in a queue; the Log starts fresh tabs each September 1 and keeps the old ones.
  On connect the app looks for sheets it already made in that account and asks before creating a second pair. Needs a Google Cloud client ID (see the README).
- **Privacy wording.** Names are now kept on the AV computer and in the connected Google account.

### Changed
- **The app is now called Kingdom Hall Attendance** (window, tray, installer `Kingdom-Hall-Attendance-Setup-<version>.exe`). The data folder keeps its old name, so nothing is lost on update.
- **Finalized meetings can still be changed.** A mark, tap or Zoom total changed after **Finalize** overwrites that meeting's record in History
  and flags the video as out of date. The AV desk shows **Update the video**; the Unlock button is gone.
- **Attendance video is 20 seconds** (was 12): intro 2.5 s, Kingdom Hall 3 s, Zoom 3 s, total 11.5 s. Still 30 fps, 1920×1080.

### Notes
- The Google sync is tested against a fake Google only; it has not run against real Google yet.
