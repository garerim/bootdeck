# Bootdeck

Application desktop pour retrouver son contexte de travail complet (éditeur, terminal, URLs, commandes) en un clic.

Plateformes : **Windows 10/11** (testé) · **Linux** (aperçu, voir [docs/linux.md](docs/linux.md)) · macOS (non testé).

Stack : Tauri 2 (Rust) · React 19 · TypeScript · Vite · Tailwind CSS 4 · shadcn/ui · Zustand · Zod · Vitest.

## Prérequis (Windows)

- Node.js 24+
- Rust stable (`rustup`, cible `x86_64-pc-windows-msvc`)
- Visual Studio 2022 avec le workload « Développement Desktop en C++ » (MSVC + Windows SDK)
- WebView2 (installé par défaut sur Windows 11)

Linux : prérequis et différences dans [docs/linux.md](docs/linux.md).

## Scripts

| Commande              | Effet                                                             |
| --------------------- | ----------------------------------------------------------------- |
| `npm run dev`         | Lance l'application desktop (Vite + Tauri, rechargement à chaud)  |
| `npm run dev:web`     | Lance uniquement le front dans un navigateur (sans Tauri)         |
| `npm run build`       | Construit l'installeur Windows (voir [docs/packaging.md](docs/packaging.md)) |
| `npm run build:web`   | Vérifie les types et construit uniquement le front (`dist/`)      |
| `npm run typecheck`   | Vérifie les types TypeScript                                      |
| `npm test`            | Lance les tests Vitest une fois (`npm run test:watch` en continu) |
| `npm run test:e2e`    | Tests de bout en bout dans le navigateur (système simulé)         |
| `npm run test:e2e:desktop` | Tests de bout en bout sur l'application réelle (Windows)     |

## Données

Les presets sont stockés dans un seul fichier JSON versionné, lisible et modifiable à la main :

| OS      | Emplacement                                                     |
| ------- | --------------------------------------------------------------- |
| Windows | `%APPDATA%\dev.bootdeck.desktop\presets.json`           |
| macOS   | `~/Library/Application Support/dev.bootdeck.desktop/…`  |
| Linux   | `~/.local/share/dev.bootdeck.desktop/…`                 |

Le chemin exact est affiché dans **Settings**. Si le fichier devient illisible, l'application ne le modifie
pas : elle propose de le renommer en `presets.invalid-<horodatage>.json` et de repartir d'une liste vide.

L'historique des lancements (écran **Recent**) est dans `sessions.json`, dans le même dossier : les 200
derniers lancements, avec les valeurs utilisées et le résultat de chaque item. Il est séparé des presets :
s'il devient illisible, il est mis de côté (`sessions.invalid-<horodatage>.json`) et repart de zéro
automatiquement, sans jamais toucher aux presets.

Dans un navigateur (`npm run dev:web`), les presets de démonstration sont gardés en mémoire uniquement.

## Variables

Un preset peut déclarer des variables (`{project}`, `{project_path}`, `{port}`…), demandées à chaque
lancement et utilisables dans tous les champs des items : `~/Projects/{project}`, `http://localhost:{port}`.

- Une valeur par défaut peut utiliser les variables déclarées avant elle : `~/Projects/{project}`.
- Types : **text** (lettres, chiffres, `.`, `-`, `_`), **path** (absolu ou `~`), **port** (1–65535).
  Aucun caractère spécial de shell n'est accepté, pour qu'une valeur ne puisse jamais ajouter de commande.
- `{{` et `}}` écrivent des accolades littérales ; `{Majuscule}` ou `{"json": 1}` ne sont pas des variables.

## Commandes lancées

Les commandes d'un preset (`npm run dev`…) sont suivies par l'application : sortie en direct, arrêt avec
le bouton Stop, et arrêt automatique à la fermeture de l'app. Sous Windows, chaque commande et les
programmes qu'elle démarre sont regroupés dans un *Job Object* : même si l'application plante, Windows
arrête ces processus, aucun serveur ne reste orphelin en occupant son port. Un programme ouvert par une
commande qui s'est terminée normalement (ex. `start notepad`) reste ouvert.

Une seule instance de l'application tourne à la fois : la relancer ramène la fenêtre existante au premier plan.

## Raccourcis clavier

| Raccourci    | Effet                                       |
| ------------ | ------------------------------------------- |
| `Ctrl+N`     | Nouveau preset                              |
| `Ctrl+S`     | Enregistrer le preset en cours d'édition    |
| `Ctrl+Enter` | Lancer le preset affiché                    |
| `Échap`      | Annuler l'édition, ou revenir à la liste    |
| `Ctrl+,`     | Réglages                                    |

Dans l'application compilée, les raccourcis du navigateur intégré (F5, Ctrl+R, Ctrl+P, Ctrl+F) et son menu
contextuel sont désactivés, sauf dans les champs de saisie.

## Tests

| Niveau | Outil | Ce qui est vérifié |
| ------ | ----- | ------------------ |
| Unitaires (TS) | Vitest, `src/**/*.test.ts` | Validation des presets, variables, étapes du lancement (ordre, validation, plan, rapport), moteur, stores |
| Unitaires (Rust) | `cargo test` dans `src-tauri` | Stockage atomique, validation des entrées, processus (sortie, arrêt de l'arbre, Job Object), messages d'erreur |
| Intégration front ↔ Rust | Vitest + `cargo test --test ipc` | Le contrat `contracts/ipc.json` : le front envoie exactement ces appels, Rust les rejoue dans le vrai pipeline IPC de Tauri (arguments, permissions, erreurs, événements) |
| Bout en bout | Playwright | Créer un preset, ajouter une URL et un dossier, enregistrer, lancer, voir le succès |

Le parcours de bout en bout tourne de deux façons :

- `npm run test:e2e` : l'interface dans Edge, avec le système simulé. Rapide, sans effet de bord.
- `npm run test:e2e:desktop` (Windows) : compile une variante de l'app (identifiant `dev.bootdeck.e2e`,
  données et instance séparées : l'app habituelle peut rester ouverte), puis la pilote à travers sa WebView2.
  Le lancement est réel : un onglet s'ouvre dans le navigateur par défaut (il reste ouvert) et une fenêtre de
  l'Explorateur (refermée par le test). La première compilation prend quelques minutes.

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
contracts/      contrat IPC partagé entre le front et Rust (tests d'intégration)
e2e/            tests de bout en bout (Playwright)
src-tauri/src/
  commands/     commandes exposées au front (fines)
  services/     logique applicative
  system/       code spécifique à chaque OS
  models/       structures échangées avec le front
  errors.rs     type d'erreur de l'application
src-tauri/tests/  tests d'intégration de l'IPC (runtime Tauri simulé)
```

## Licence

[MIT](LICENSE)
