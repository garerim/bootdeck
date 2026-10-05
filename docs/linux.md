# Bootdeck sous Linux

État : **aperçu**. Le code compile et tous les tests Rust passent sous Linux (Debian 12, en conteneur).
L'interface n'a pas encore été essayée sur un vrai bureau Linux : les retours sont les bienvenus.

## 1. Prérequis

Dépendances système de Tauri 2 (source : [prérequis officiels](https://v2.tauri.app/start/prerequisites/)) :

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

Autres distributions : voir la page officielle.

Puis **Rust** (stable, via [rustup](https://rustup.rs)) et **Node.js 24** (via [nvm](https://github.com/nvm-sh/nvm)
ou le gestionnaire de paquets) :

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

## 2. Lancer l'application

```bash
npm ci
npm run dev
```

La première compilation prend plusieurs minutes. Les données sont dans
`~/.local/share/dev.bootdeck.desktop/` (`presets.json`, `sessions.json`).

## 3. Construire les paquets

```bash
npm run build
```

Produit `.deb`, `.rpm` et `.AppImage` dans `src-tauri/target/release/bundle/` (configuration :
`src-tauri/tauri.linux.conf.json`).

## Différences avec Windows

| Sujet | Linux |
| ----- | ----- |
| Commandes | Exécutées par votre shell en mode connexion (`$SHELL -l -c "…"`), qui charge votre profil. |
| Arrêter une commande | SIGTERM à tout son groupe de processus, puis SIGKILL après 3 s s'il résiste. |
| Fermeture de l'app | Les commandes en cours sont arrêtées. |
| **Plantage de l'app** | **Les commandes continuent de tourner** (pas d'équivalent simple aux Job Objects de Windows). |
| Commande introuvable | Reconnue au code de sortie 127 du shell. |
| Applications | Nom présent dans le PATH (`code`, `firefox`, `gnome-terminal`…) ou chemin absolu. |
| URLs et dossiers | Ouverts avec l'application par défaut (`xdg-open`). |
| Instance unique | Via D-Bus (session de bureau). |

## En cas de problème

- **Fenêtre blanche ou vide** (certaines cartes graphiques, NVIDIA et Wayland notamment) : relancer avec
  `WEBKIT_DISABLE_DMABUF_RENDERER=1 npm run dev`.
- **`npm` ou `node` introuvable dans une commande** alors qu'ils fonctionnent dans votre terminal : s'ils
  sont installés avec nvm, ils ne sont chargés que par `~/.bashrc` (shell interactif). Lancez l'app depuis un
  terminal (`npm run dev`), ou indiquez le chemin complet de `npm` dans la commande.
- **Erreur de compilation qui mentionne `webkit2gtk` ou `pkg-config`** : un prérequis manque (étape 1).

## À vérifier lors d'un premier essai

1. L'application démarre ; le thème suit celui du système.
2. Créer un preset avec une URL, un dossier, une application (`code`, `gnome-text-editor`…) et une commande
   (`ping -c 3 localhost`, puis une commande longue comme `sleep 300`).
3. Lancer : la page s'ouvre dans le navigateur, le dossier dans le gestionnaire de fichiers, l'application
   démarre, la sortie de la commande s'affiche.
4. Bouton Stop sur la commande longue ; puis relancer et fermer l'app : la commande doit s'arrêter
   (`ps aux | grep sleep`).
5. Variables (`{port}`), boutons « Parcourir… », raccourcis clavier (`Ctrl+N`, `Ctrl+S`, `Échap`).
6. Relancer l'app : presets et historique (Recent) sont conservés ; une 2ᵉ instance ramène la fenêtre existante.
