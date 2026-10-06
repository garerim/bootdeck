# Changelog

All notable changes to Bootdeck are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org).

## [0.1.0] - 2026-10-06

First public release.

### Added

- Presets with four kinds of items: applications (arguments and working folder), web pages, folders and
  commands, launched in order with a status per item.
- Variables (`text`, `path`, `port`) asked at launch and validated, usable in every item field.
- Commands with live output, exit code and a Stop button. They stop when Bootdeck closes; on Windows, a
  Job Object stops them even if the app crashes.
- Clear errors for a missing program, command or folder, with a link to fix the item.
- Notifications when a launch fails or a command stops with an error in the background.
- Launch history (last 200 launches) with "Launch again".
- Keyboard shortcuts, a single app instance, and a warning before losing unsaved changes.
- Local JSON storage with atomic writes, and recovery when a file becomes unreadable.
- Windows installer (NSIS, per user, no administrator rights). Linux builds from source (preview).

[0.1.0]: https://github.com/garerim/bootdeck/releases/tag/v0.1.0
