import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "@/app/app";
import { followSystemTheme } from "@/lib/theme";
import { presetsStore } from "@/stores/presets-store";
import "@/index.css";

followSystemTheme();
// Lancé une seule fois, ici plutôt que dans un useEffect (que le StrictMode exécute deux fois en dev).
void presetsStore.getState().initialize();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
