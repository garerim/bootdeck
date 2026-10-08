# Bootdeck on Linux

Status: **preview**. The code builds and all Rust tests pass on Linux (Debian 12, in a container).
The interface has not been tried on a real Linux desktop yet: feedback is very welcome.

## 1. Requirements

Tauri 2 system dependencies (source: [official prerequisites](https://v2.tauri.app/start/prerequisites/)):

**Debian / Ubuntu / Mint / Pop!_OS**

```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

**Fedora**

```bash
sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget file libappindicator-gtk3-devel librsvg2-devel libxdo-devel
sudo dnf group install "c-development"
```

**Arch / Manjaro**

```bash
sudo pacman -S --needed webkit2gtk-4.1 base-devel curl wget file openssl appmenu-gtk-module libappindicator-gtk3 librsvg xdotool
```

Other distributions: see the official page.

Then **Rust** (stable, with [rustup](https://rustup.rs)) and **Node.js 24** (with [nvm](https://github.com/nvm-sh/nvm)
or your package manager):

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

## 2. Run the app

```bash
npm ci
npm run dev
```

The first build takes several minutes. Your data is stored in
`~/.local/share/dev.bootdeck.desktop/` (`presets.json`, `sessions.json`).

## 3. Build the packages

```bash
npm run build
```

This produces `.deb`, `.rpm` and `.AppImage` files in `src-tauri/target/release/bundle/` (configuration:
`src-tauri/tauri.linux.conf.json`).

## Differences from Windows

| Topic | Linux |
| ----- | ----- |
| Commands | Run by your shell as a login shell (`$SHELL -l -c "…"`), which loads your profile. |
| Stopping a command | SIGTERM to its whole process group, then SIGKILL after 3 s if it does not stop. |
| Closing the app | Running commands are stopped. |
| **App crash** | **Commands keep running** (there is no simple equivalent of Windows Job Objects). |
| Command not found | Detected from the shell's exit code 127. |
| Applications | A name on the PATH (`code`, `firefox`, `gnome-terminal`…) or an absolute path. |
| URLs and folders | Opened with the default application (`xdg-open`). |
| Single instance | Through D-Bus (desktop session). |

## Troubleshooting

- **White or empty window** (some graphics cards, NVIDIA and Wayland in particular): restart with
  `WEBKIT_DISABLE_DMABUF_RENDERER=1 npm run dev`.
- **`npm` or `node` not found in a command** although they work in your terminal: if they are installed with
  nvm, only `~/.bashrc` loads them (interactive shell). Start the app from a terminal (`npm run dev`), or use
  the full path to `npm` in the command.
- **Build error mentioning `webkit2gtk` or `pkg-config`**: a requirement is missing (step 1).

## What to check on a first try

1. The app starts, and its theme follows the system theme.
2. Create a preset with a URL, a folder, an application (`code`, `gnome-text-editor`…) and a command
   (`ping -c 3 localhost`, then a long one such as `sleep 300`).
3. Launch: the page opens in the browser, the folder in the file manager, the application starts, and the
   command output is shown.
4. Press Stop on the long command. Then launch again and close the app: the command must stop
   (`ps aux | grep sleep`).
5. Variables (`{port}`), the folder and program pickers (the folder icon next to the fields), and keyboard shortcuts (<kbd>Ctrl</kbd>+<kbd>N</kbd>,
   <kbd>Ctrl</kbd>+<kbd>S</kbd>, <kbd>Esc</kbd>).
6. Restart the app: presets and history (Recent) are kept. Starting a second instance brings the existing
   window to the front.

If something does not work, please [open an issue](https://github.com/garerim/bootdeck/issues/new/choose)
with your distribution, desktop and display server (X11 or Wayland).
