# Workspace Presets

Application desktop pour retrouver son contexte de travail complet (éditeur, terminal, URLs, commandes) en un clic.

Stack : Tauri 2 (Rust) · React 19 · TypeScript · Vite · Tailwind CSS 4 · shadcn/ui · Zustand · Zod · Vitest.

## Prérequis (Windows)

- Node.js 24+
- Rust stable (`rustup`, cible `x86_64-pc-windows-msvc`)
- Visual Studio 2022 avec le workload « Développement Desktop en C++ » (MSVC + Windows SDK)
- WebView2 (installé par défaut sur Windows 11)

## Scripts

| Commande              | Effet                                                             |
| --------------------- | ----------------------------------------------------------------- |
| `npm run dev`         | Lance l'application desktop (Vite + Tauri, rechargement à chaud)  |
| `npm run dev:web`     | Lance uniquement le front dans un navigateur (sans Tauri)         |
| `npm run build`       | Construit l'application et ses installeurs                        |
| `npm run build:web`   | Vérifie les types et construit uniquement le front (`dist/`)      |
| `npm run typecheck`   | Vérifie les types TypeScript                                      |
| `npm test`            | Lance les tests Vitest une fois (`npm run test:watch` en continu) |

## Organisation

```text
src/
  app/          shell de l'application
  components/   ui/ (shadcn) et layout/
  features/     écrans, regroupés par fonctionnalité
  domain/       logique métier pure : aucun import React ni Tauri
  platform/     seul dossier autorisé à importer @tauri-apps/*
  stores/       état global (Zustand)
  hooks/  lib/
src-tauri/src/
  commands/     commandes exposées au front (fines)
  services/     logique applicative
  system/       code spécifique à chaque OS
  models/       structures échangées avec le front
  errors.rs     type d'erreur de l'application
```
