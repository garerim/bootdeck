import { create } from "zustand";

/**
 * Écran affiché. Une union discriminée : chaque écran déclare ses propres
 * paramètres, et `navigate({ name: "preset-detail" })` sans `presetId` ne compile pas.
 *
 * Pas de routeur basé sur les URL : une app desktop n'a pas de barre d'adresse.
 */
export type Route =
  | { name: "presets" }
  | { name: "preset-detail"; presetId: string }
  | { name: "preset-new" }
  | { name: "preset-edit"; presetId: string }
  | { name: "recent" }
  | { name: "settings" };

interface NavigationState {
  route: Route;
  navigate: (route: Route) => void;
}

export const useNavigationStore = create<NavigationState>()((set) => ({
  route: { name: "presets" },
  navigate: (route) => set({ route }),
}));
