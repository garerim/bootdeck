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
  /** `itemId` : item à mettre en avant à l'ouverture (ex. « corriger cet item »). */
  | { name: "preset-edit"; presetId: string; itemId?: string }
  | { name: "recent" }
  | { name: "settings" };

export interface NavigateOptions {
  /** Ignore les modifications non enregistrées (ex. juste après les avoir enregistrées). */
  force?: boolean;
}

interface NavigationState {
  route: Route;
  /** L'écran courant a des modifications non enregistrées : quitter demande confirmation. */
  unsavedChanges: boolean;
  /** Destination retenue en attendant que l'utilisateur confirme l'abandon des modifications. */
  pendingRoute: Route | null;
  navigate: (route: Route, options?: NavigateOptions) => void;
  setUnsavedChanges: (unsaved: boolean) => void;
  /** Abandonne les modifications et va à la destination retenue. */
  confirmNavigation: () => void;
  /** Reste sur l'écran courant. */
  cancelNavigation: () => void;
}

function isSameRoute(a: Route, b: Route): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export const useNavigationStore = create<NavigationState>()((set, get) => ({
  route: { name: "presets" },
  unsavedChanges: false,
  pendingRoute: null,
  navigate: (route, options = {}) => {
    const { route: current, unsavedChanges } = get();
    if (isSameRoute(route, current)) return;
    if (unsavedChanges && !options.force) {
      set({ pendingRoute: route });
      return;
    }
    set({ route, unsavedChanges: false, pendingRoute: null });
  },
  setUnsavedChanges: (unsavedChanges) => set({ unsavedChanges }),
  confirmNavigation: () => {
    const { pendingRoute } = get();
    if (pendingRoute) set({ route: pendingRoute, unsavedChanges: false, pendingRoute: null });
  },
  cancelNavigation: () => set({ pendingRoute: null }),
}));
