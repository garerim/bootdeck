import { isTauri } from "@tauri-apps/api/core";

/**
 * Vrai dans la fenêtre desktop Tauri, faux dans un simple navigateur (`npm run dev:web`).
 * Servira à choisir entre les adapters Tauri et mock.
 */
export function isDesktop(): boolean {
  return isTauri();
}
