import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "@/app/app";
import { followSystemTheme } from "@/lib/theme";
import { launchStore } from "@/stores/launch-store";
import { presetsStore } from "@/stores/presets-store";
import { recordSessions, sessionsStore } from "@/stores/sessions-store";
import "@/index.css";

followSystemTheme();
// Lancés une seule fois, ici plutôt que dans un useEffect (que le StrictMode exécute deux fois en dev).
void presetsStore.getState().initialize();
void sessionsStore.getState().initialize();
// Chaque lancement complet est enregistré dans l'historique.
recordSessions(launchStore, sessionsStore);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
