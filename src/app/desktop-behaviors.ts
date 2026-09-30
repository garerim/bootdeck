import { isBrowserShortcut } from "@/lib/browser-shortcuts";

/**
 * Fait se comporter la fenêtre comme une application, pas comme une page web :
 * - pas de rechargement, d'impression ni de recherche dans la page au clavier ;
 * - pas de menu contextuel du navigateur (« Actualiser », « Inspecter »…), sauf
 *   dans un champ de saisie ou sur du texte sélectionné, où Copier/Coller servent.
 *
 * Appelé seulement dans l'app desktop compilée : en développement, F5 et
 * l'inspecteur restent utiles.
 */
export function disableBrowserBehaviors(): void {
  window.addEventListener(
    "keydown",
    (event) => {
      if (isBrowserShortcut(event)) event.preventDefault();
    },
    { capture: true },
  );

  window.addEventListener("contextmenu", (event) => {
    const editable =
      event.target instanceof Element && event.target.closest('input, textarea, [contenteditable="true"]') !== null;
    const hasSelection = (window.getSelection()?.toString() ?? "") !== "";
    if (!editable && !hasSelection) event.preventDefault();
  });
}
