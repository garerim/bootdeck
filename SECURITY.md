# Security policy

Bootdeck runs commands on your computer, so security reports are taken seriously.

## Supported versions

Only the [latest release](https://github.com/garerim/bootdeck/releases/latest) receives security fixes.

## Reporting a vulnerability

**Please do not open a public issue.** Report it privately with GitHub's
[private vulnerability reporting](https://github.com/garerim/bootdeck/security/advisories/new)
(the "Report a vulnerability" button in the Security tab).

Include what you found, the steps to reproduce it, the affected version and your OS. You will get an answer
within a week. Once a fix is released, the advisory is published and you are credited, unless you prefer not
to be.

## What Bootdeck protects against

These are the guarantees a report can break:

- **No remote content can run a command.** Commands come only from the user's presets and run only when the
  user presses Launch.
- **The interface cannot load remote code.** A strict Content Security Policy allows only the files bundled
  with the app.
- **Minimal permissions.** The interface can only call the commands Bootdeck declares, with the Tauri
  capabilities it needs.
- **Validated inputs.** Everything the interface sends is validated again in Rust. Variable values cannot
  contain shell special characters, so a value can never add a command.
- **Nothing leaves the computer.** No telemetry, no account, no update server.

## Out of scope

- Someone who can already write to your presets file (`presets.json`) or run programs as your user can
  already run code on your machine: that is not a vulnerability in Bootdeck.
- The behavior of the programs, commands and web pages that you choose to launch.
