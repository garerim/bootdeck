# Contributing to Bootdeck

Thanks for your interest. Bug reports, ideas, documentation fixes and pull requests are all welcome.
Testing on **Linux** and **macOS** is especially helpful: Bootdeck is only fully tested on Windows so far.

By taking part, you agree to follow the [code of conduct](CODE_OF_CONDUCT.md). Security issues must be
reported privately, see [SECURITY.md](SECURITY.md).

## Ways to contribute

- **Report a bug** with the [bug report form](https://github.com/garerim/bootdeck/issues/new/choose): your OS,
  the Bootdeck version and the steps to reproduce help a lot.
- **Suggest a feature** with the feature request form. Explain the problem first, then your idea.
- **Send a pull request.** For anything bigger than a small fix, open an issue first so we can agree on the
  approach before you spend time on it.

## Development setup

Requirements on Windows:

- Node.js 24+
- Rust stable (`rustup`, target `x86_64-pc-windows-msvc`)
- Visual Studio 2022 with the "Desktop development with C++" workload (MSVC and the Windows SDK)
- WebView2 (included in Windows 11)

On Linux, see the [Linux guide](docs/linux.md) for the system packages.

```bash
git clone https://github.com/garerim/bootdeck.git
cd bootdeck
npm install
npm run dev
```

| Command | What it does |
| ------- | ------------ |
| `npm run dev` | The desktop app (Vite + Tauri) with hot reload |
| `npm run dev:web` | The interface alone in a browser, with a simulated system and demo presets |
| `npm run build` | The Windows installer (see [docs/packaging.md](docs/packaging.md)) |
| `npm run build:web` | Type-checks and builds the interface only (`dist/`) |
| `npm run typecheck` | Type-checks the TypeScript code |
| `npm test` | Vitest, once (`npm run test:watch` to keep it running) |
| `npm run test:e2e` | End-to-end tests in the browser, with the simulated system |
| `npm run test:e2e:desktop` | End-to-end tests on the real app (Windows) |
| `npm run screenshots` | Regenerates the screenshots of the website |

## Project structure

```text
src/
  app/          application shell
  components/   ui/ (shadcn) and layout/
  features/     screens, grouped by feature
  domain/       pure business logic: no React or Tauri import
  platform/     the only folder allowed to import @tauri-apps/*
  stores/       global state (Zustand)
  hooks/  lib/
contracts/      IPC contract shared by the interface and Rust (integration tests)
e2e/            end-to-end tests (Playwright)
src-tauri/src/
  commands/     commands exposed to the interface (thin)
  services/     application logic
  system/       OS-specific code (Windows Job Objects, Unix process groups)
  models/       structures exchanged with the interface
  errors.rs     the application error type
src-tauri/tests/  IPC integration tests (mocked Tauri runtime)
```

## Rules of the codebase

- **The domain stays pure.** `src/domain` imports neither React nor Tauri, so it can be tested in isolation.
  Only `src/platform` talks to Tauri.
- **Validate at the boundary, twice.** Data is validated with Zod in the interface and again in Rust: the
  Rust side never trusts what the interface sends.
- **No `any`** in TypeScript, and **no `unwrap()`** in Rust on a path that a user error can reach.
- **OS-specific behavior lives in `src-tauri/src/system/`** and is documented where it differs between
  Windows and Unix.
- **No remote content may ever run a command.** Commands come from the user's presets and run only when
  the user asks. Keep Tauri permissions minimal: add a capability only when a feature needs it.
- **New dependencies need a reason.** Explain in the pull request why it is needed and which alternatives
  you considered.

## Tests

| Level | Tool | What is covered |
| ----- | ---- | --------------- |
| Unit (TypeScript) | Vitest, `src/**/*.test.ts` | Preset validation, variables, the launch pipeline (order, validation, plan, report), engine, stores |
| Unit (Rust) | `cargo test` in `src-tauri` | Atomic storage, input validation, processes (output, tree termination, Job Objects), error messages |
| Interface and Rust | Vitest + `cargo test --test ipc` | The `contracts/ipc.json` contract: the interface sends exactly these calls, and Rust replays them through the real Tauri IPC pipeline (arguments, permissions, errors, events) |
| End to end | Playwright | Create a preset, add a URL and a folder, save, launch, see the result |

The end-to-end scenario runs in two ways:

- `npm run test:e2e`: the interface in Edge with the simulated system. Fast, no side effects.
- `npm run test:e2e:desktop` (Windows): builds a variant of the app (identifier `dev.bootdeck.e2e`, with its
  own data and instance, so your usual Bootdeck can stay open), then drives it through its WebView2. The
  launch is real: a tab opens in your default browser and a File Explorer window opens (the test closes
  it). The first build takes a few minutes.

## Before you open a pull request

```bash
npm run typecheck
npm test
npm run test:e2e
cd src-tauri && cargo test && cargo clippy --all-targets -- -D warnings
```

- Keep the pull request focused on one change, and describe what it changes and how you tested it.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org): `feat: …`, `fix: …`,
  `docs: …`, `test: …`, `refactor: …`, `build: …`, `chore: …`.
- If you change something the user sees, add a screenshot to the pull request.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
