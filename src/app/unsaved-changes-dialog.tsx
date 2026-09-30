import { useRef } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useNavigationStore } from "@/stores/navigation-store";

/** Confirmation affichée quand on quitte l'éditeur avec des modifications non enregistrées. */
export function UnsavedChangesDialog() {
  const pendingRoute = useNavigationStore((state) => state.pendingRoute);
  const confirmNavigation = useNavigationStore((state) => state.confirmNavigation);
  const cancelNavigation = useNavigationStore((state) => state.cancelNavigation);
  // Élément qui avait le focus avant la question (souvent le champ en cours de saisie).
  const previousFocus = useRef<Element | null>(null);

  return (
    <AlertDialog open={pendingRoute !== null} onOpenChange={(open) => !open && cancelNavigation()}>
      <AlertDialogContent
        onOpenAutoFocus={() => {
          previousFocus.current = document.activeElement;
        }}
        onCloseAutoFocus={(event) => {
          // « Keep editing » : retour au champ quitté. Après « Discard », il n'existe
          // plus et le nouvel écran a déjà placé le focus sur son titre.
          event.preventDefault();
          const element = previousFocus.current;
          if (element instanceof HTMLElement && element.isConnected) element.focus();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
          <AlertDialogDescription>Your changes to this preset haven’t been saved.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {/* Radix place le focus sur « Keep editing » : Entrée par réflexe ne détruit rien. */}
          <AlertDialogCancel>Keep editing</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={confirmNavigation}>
            Discard changes
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
