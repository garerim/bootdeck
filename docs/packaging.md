# Packaging (Windows)

Workspace Presets est distribué sous la forme d'un **installeur NSIS par utilisateur** :
aucun droit administrateur n'est demandé, ni pour installer, ni pour lancer l'application.

> macOS et Linux : non testés. Tauri sait produire `.app`/`.dmg` et `.deb`/`.AppImage`, mais chaque
> paquet doit être construit **sur** son système (voir la fin de ce document).

## Construire l'installeur

Prérequis : ceux du [README](../README.md#prérequis-windows). Au premier build, le CLI Tauri télécharge
les outils NSIS dans `%LOCALAPPDATA%\tauri` (accès Internet nécessaire une fois).

```bash
npm run build
```

Étapes enchaînées par `tauri build` :

1. `npm run build:web` : vérification des types puis build du front (`dist/`) ;
2. `cargo build --release` : optimisations maximales (`lto`, `codegen-units = 1`, `opt-level = 3`,
   `panic = "abort"`, symboles retirés), le front est **embarqué dans l'exécutable** ;
3. NSIS : `src-tauri/target/release/bundle/nsis/Workspace Presets_<version>_x64-setup.exe`.

Le runtime Visual C++ est lié statiquement (réglage par défaut de Tauri) : aucun
« Visual C++ Redistributable » à installer.

## Avant une nouvelle version

1. Tests : `npm test`, `cargo test` (dans `src-tauri`), `npm run test:e2e`, `npm run test:e2e:desktop`.
2. Numéro de version, **au même endroit dans les trois fichiers** : `package.json`,
   `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json` (c'est ce dernier qu'utilise l'installeur).
3. `npm run build`, puis la vérification ci-dessous sur l'installeur produit.

## Installer

- Double-cliquer sur l'installeur. Installation dans `%LOCALAPPDATA%\Workspace Presets`, raccourci dans
  le menu Démarrer, entrée dans *Paramètres > Applications* (registre `HKCU`, rien dans `HKLM`).
- Installation silencieuse (déploiement, tests) : `"Workspace Presets_<version>_x64-setup.exe" /S`.
- **WebView2** : présent sur Windows 11. Sur un Windows 10 qui ne l'aurait pas, l'installeur télécharge et
  exécute l'installeur officiel de Microsoft (`webviewInstallMode: downloadBootstrapper`). Pour une machine
  sans Internet, passer à `offlineInstaller` (+ ~127 Mo).
- **SmartScreen** : l'installeur n'est pas signé. Téléchargé depuis Internet, Windows affichera
  « Windows a protégé votre ordinateur » (*Informations complémentaires > Exécuter quand même*). Voir
  « Signature de code ».

## Données de l'utilisateur

| Emplacement | Contenu |
| ----------- | ------- |
| `%APPDATA%\dev.workspacepresets.desktop\` | `presets.json`, `sessions.json` (voir le README) |
| `%LOCALAPPDATA%\dev.workspacepresets.desktop\` | Cache et profil de la WebView2 |

Ces dossiers dépendent de l'**identifiant** de l'application (`dev.workspacepresets.desktop`), pas du
dossier d'installation : ils survivent aux mises à jour et aux réinstallations. Ne jamais changer
l'identifiant d'une version à l'autre, les utilisateurs perdraient leurs presets.

Même identifiant pour `npm run dev` et la version installée : ils partagent les données et l'instance
unique (lancer l'un ramène la fenêtre de l'autre s'il est ouvert).

## Mettre à jour

Lancer l'installeur de la nouvelle version par-dessus l'ancienne : les données, rangées hors du dossier
d'installation, sont conservées (vérifié en réinstallant la même version), et un
fichier écrit par une version plus récente n'est jamais écrasé par une plus ancienne (il est ouvert en
lecture seule ou signalé). Pas de mise à jour automatique dans le MVP.

## Désinstaller

*Paramètres > Applications > Workspace Presets > Désinstaller*, ou `uninstall.exe` dans le dossier
d'installation. Les presets sont **conservés**, sauf si l'utilisateur coche « Delete the application
data » dans le désinstalleur (jamais en mode silencieux `/S`).

## Signature de code (pas encore en place)

Signer l'installeur et l'exécutable supprime l'avertissement SmartScreen et prouve leur origine. Il faut
un certificat de signature de code (autorité de certification, ou Azure Trusted Signing), puis dans
`tauri.conf.json` > `bundle > windows` : `certificateThumbprint` (certificat installé localement) ou
`signCommand` (service de signature). À faire avant toute diffusion publique.

## Icônes

Source unique : `src-tauri/icons/app-icon.svg`. Après modification, régénérer les tailles utilisées :

```bash
npx tauri icon src-tauri/icons/app-icon.svg --output <dossier temporaire>
```

puis copier dans `src-tauri/icons/` les fichiers qui y existent déjà (`*.png`, `icon.ico`,
`icon.icns`) ; les dossiers `android/` et `ios/` ne servent pas.

## macOS et Linux (non testés)

`bundle.targets` ne contient que `nsis`. Pour d'autres systèmes, ajouter `app`/`dmg` (macOS) ou
`deb`/`appimage` (Linux) et construire sur une machine de ce système (ou en CI). Le code spécifique
(`src-tauri/src/system/unix.rs`) n'a jamais été compilé : à vérifier en premier.

## Vérification d'une version installée

Procédure suivie pour la version 0.1.0 (Windows 11, session **sans** droits administrateur), à refaire
avant chaque diffusion. Les données de l'utilisateur sont mises de côté avant, puis restaurées.

| Vérification | Comment | Résultat 0.1.0 |
| ------------ | ------- | -------------- |
| Taille | Fichiers produits | Installeur 1,6 Mo, exécutable 4,9 Mo |
| Installation sans administrateur | `setup.exe /S` depuis une session non élevée ; `RequestExecutionLevel user` dans le script NSIS | OK en ~2 s, rien dans `HKLM` |
| Fichiers et raccourcis | Dossier d'installation, menu Démarrer, bureau, *Paramètres > Applications* | `%LOCALAPPDATA%\Workspace Presets` (exe + uninstall.exe), 2 raccourcis, entrée HKCU |
| Dépendances | `dumpbin /DEPENDENTS` sur l'exécutable | DLL de Windows uniquement (CRT universelle), pas de `VCRUNTIME140.dll` |
| Lancement | Raccourci / exécutable installé | OK, front embarqué (`http://tauri.localhost`) |
| CSP | Injection d'un `<script>` inline et d'un script distant | Bloqués tous les deux |
| Permissions Tauri | Appel de commandes non accordées (`plugin:dialog\|open`, `plugin:window\|set_title`) | « not allowed by ACL » ; outils de développement absents du build |
| Persistance | Créer un preset, fermer, relancer | Preset relu depuis `presets.json` |
| Fermeture pendant une commande | Fermer la fenêtre pendant un `ping` | `ping` arrêté ; au redémarrage, l'historique indique le lancement interrompu (*Stopped*) |
| Plantage | `taskkill /F` pendant un `ping` | `ping` arrêté par Windows (Job Object) |
| Instance unique | Relancer l'app ouverte | La 2ᵉ instance se ferme (~1 s), la fenêtre existante revient |
| Réinstallation | Relancer l'installeur (même version) par-dessus | `presets.json` inchangé |
| Désinstallation | `uninstall.exe /S` | Dossier, entrée et raccourcis retirés ; données conservées |

Non vérifié : redémarrage **de Windows** (l'application ne s'y inscrit nulle part : ni démarrage
automatique, ni service ; ses données sont de simples fichiers), montée vers une version plus récente
(seule la réinstallation de la même version a été faite), installation sur une machine sans WebView2,
installeur téléchargé depuis Internet (SmartScreen).
