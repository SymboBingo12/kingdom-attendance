# Changelog

## Unreleased

### Added
- **Publisher list groups.** The list now has **Publishers**, **Unbaptized publishers** and an **Invited** section.
  Invited entries take a name or family group, how many they are, and Kingdom Hall or Zoom. Adding one also marks it for today's meeting.
- **New CSV template.** The blank template has `Publishers` and `Unbaptized publishers` columns. The old `Name,Group` format still imports.
  Capitalised `UNBAPTIZED PUBLISHERS` and `INVITED` lines in pasted lists and Excel files start the matching groups.

### Changed
- **Finalized meetings can still be changed.** A mark, tap or Zoom total changed after **Finalize** overwrites that meeting's record in History
  and flags the video as out of date. The AV desk shows **Update the video**; the Unlock button is gone.
- **Attendance video is 20 seconds** (was 12): intro 2.5 s, Kingdom Hall 3 s, Zoom 3 s, total 11.5 s. Still 30 fps, 1920×1080.

### Notes
- Planned, not built: sending finalized attendance to Google Sheets (see the automation proposal).
