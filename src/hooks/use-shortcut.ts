import { useEffect, useRef } from "react";
import { matchesShortcut, type Shortcut } from "@/lib/shortcuts";

/**
 * Déclenche `handler` sur un raccourci clavier, tant que le composant est affiché.
 *
 * Ignoré quand :
 * - une boîte de dialogue a le focus (elle gère son propre clavier : Échap la ferme) ;
 * - un composant a déjà traité la touche (`defaultPrevented`, ex. Échap qui ferme un menu) ;
 * - la touche est maintenue enfoncée (`repeat`) : Ctrl+Entrée ne relance pas en boucle.
 */
export function useShortcut(shortcut: Shortcut, handler: () => void, enabled = true): void {
  // Toujours la dernière version du handler, sans réinscrire l'écouteur à chaque rendu.
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });

  const { key, mod, shift } = shortcut;
  useEffect(() => {
    if (!enabled) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat || event.isComposing) return;
      if (!matchesShortcut(event, { key, mod, shift })) return;
      if (event.target instanceof Element && event.target.closest('[role="dialog"], [role="alertdialog"]')) return;
      event.preventDefault();
      handlerRef.current();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, key, mod, shift]);
}
