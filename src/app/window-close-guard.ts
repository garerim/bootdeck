import { holdWindowClose } from "@/platform/window";
import { useNavigationStore } from "@/stores/navigation-store";

/**
 * Tant que l'éditeur a des modifications non enregistrées, fermer la fenêtre
 * pose la même question que quitter l'éditeur (UnsavedChangesDialog).
 */
export function guardWindowCloseWhileEditing(): void {
  let release: Promise<() => void> | null = null;
  useNavigationStore.subscribe((state, previous) => {
    if (state.unsavedChanges === previous.unsavedChanges) return;
    if (state.unsavedChanges) {
      release = holdWindowClose(() => useNavigationStore.getState().requestClose());
    } else if (release) {
      void release.then((restore) => restore());
      release = null;
    }
  });
}
