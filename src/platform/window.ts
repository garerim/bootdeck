import { getCurrentWindow } from "@tauri-apps/api/window";
import { isDesktop } from "@/platform/runtime";

/**
 * Retient la fermeture de la fenêtre (croix, Alt+F4) : `onCloseRequested` est
 * appelé à la place. Renvoie la fonction qui rétablit la fermeture normale.
 *
 * Tauri ne passe par le JavaScript que si un écouteur existe : on ne l'installe
 * que le temps nécessaire, pour qu'un front bloqué n'empêche jamais de fermer l'app.
 * Sans effet dans un navigateur.
 */
export async function holdWindowClose(onCloseRequested: () => void): Promise<() => void> {
  if (!isDesktop()) return () => {};
  return getCurrentWindow().onCloseRequested((event) => {
    event.preventDefault();
    onCloseRequested();
  });
}

/** Ferme la fenêtre sans redemander (permission `core:window:allow-destroy`). */
export async function closeWindow(): Promise<void> {
  if (isDesktop()) await getCurrentWindow().destroy();
}
