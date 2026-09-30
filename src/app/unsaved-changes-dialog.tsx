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
import { closeWindow } from "@/platform/window";
import { useNavigationStore } from "@/stores/navigation-store";

/**
 * Confirmation affichée quand on quitte l'éditeur, ou qu'on ferme la fenêtre,
 * avec des modifications non enregistrées.
 */
export function UnsavedChangesDialog() {
  const pendingLeave = useNavigationStore((state) => state.pendingLeave);
  const confirmLeave = useNavigationStore((state) => state.confirmLeave);
  const cancelLeave = useNavigationStore((state) => state.cancelLeave);
  const closing = pendingLeave?.kind === "close-window";
  // Élément qui avait le focus avant la question (souvent le champ en cours de saisie).
  const previousFocus = useRef<Element | null>(null);

  return (
    <AlertDialog open={pendingLeave !== null} onOpenChange={(open) => !open && cancelLeave()}>
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
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              if (confirmLeave()?.kind === "close-window") void closeWindow();
            }}
          >
            {closing ? "Discard and quit" : "Discard changes"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
