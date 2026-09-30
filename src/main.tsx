import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "@/app/app";
import { disableBrowserBehaviors } from "@/app/desktop-behaviors";
import { notifyLaunchProblems } from "@/features/launch/launch-notices";
import { followSystemTheme } from "@/lib/theme";
import { isDesktop } from "@/platform/runtime";
import { launchStore } from "@/stores/launch-store";
import { presetsStore } from "@/stores/presets-store";
import { recordSessions, sessionsStore } from "@/stores/sessions-store";
import "@/index.css";

followSystemTheme();
// Application compilée : plus de F5, Ctrl+P ni menu « Inspecter » (gardés en développement).
if (isDesktop() && import.meta.env.PROD) disableBrowserBehaviors();
// Lancés une seule fois, ici plutôt que dans un useEffect (que le StrictMode exécute deux fois en dev).
void presetsStore.getState().initialize();
void sessionsStore.getState().initialize();
// Chaque lancement complet est enregistré dans l'historique.
recordSessions(launchStore, sessionsStore);
// Un échec hors de l'écran affiché (ex. serveur de dev qui s'arrête) est signalé par une notification.
notifyLaunchProblems(launchStore);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
