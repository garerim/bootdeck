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

/** Ce que l'utilisateur voulait faire quand la garde l'a retenu. */
export type PendingLeave = { kind: "navigate"; route: Route } | { kind: "close-window" };

export interface NavigateOptions {
  /** Ignore les modifications non enregistrées (ex. juste après les avoir enregistrées). */
  force?: boolean;
}

interface NavigationState {
  route: Route;
  /** L'écran courant a des modifications non enregistrées : le quitter demande confirmation. */
  unsavedChanges: boolean;
  /** Action retenue en attendant que l'utilisateur confirme l'abandon des modifications. */
  pendingLeave: PendingLeave | null;
  navigate: (route: Route, options?: NavigateOptions) => void;
  /** La fenêtre va être fermée alors qu'il reste des modifications : demande confirmation. */
  requestClose: () => void;
  setUnsavedChanges: (unsaved: boolean) => void;
  /**
   * Abandonne les modifications. Une navigation retenue a lieu aussitôt ; une
   * fermeture est renvoyée à l'appelant, qui ferme la fenêtre (le store ne
   * dépend pas de Tauri).
   */
  confirmLeave: () => PendingLeave | null;
  /** Reste sur l'écran courant. */
  cancelLeave: () => void;
}

function isSameRoute(a: Route, b: Route): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export const useNavigationStore = create<NavigationState>()((set, get) => ({
  route: { name: "presets" },
  unsavedChanges: false,
  pendingLeave: null,
  navigate: (route, options = {}) => {
    const { route: current, unsavedChanges } = get();
    if (isSameRoute(route, current)) return;
    if (unsavedChanges && !options.force) {
      set({ pendingLeave: { kind: "navigate", route } });
      return;
    }
    set({ route, unsavedChanges: false, pendingLeave: null });
  },
  requestClose: () => {
    if (get().unsavedChanges) set({ pendingLeave: { kind: "close-window" } });
  },
  setUnsavedChanges: (unsavedChanges) => set({ unsavedChanges }),
  confirmLeave: () => {
    const { pendingLeave } = get();
    if (!pendingLeave) return null;
    set({
      unsavedChanges: false,
      pendingLeave: null,
      ...(pendingLeave.kind === "navigate" ? { route: pendingLeave.route } : {}),
    });
    return pendingLeave;
  },
  cancelLeave: () => set({ pendingLeave: null }),
}));
