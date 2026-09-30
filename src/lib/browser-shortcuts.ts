import { matchesShortcut, type Shortcut } from "@/lib/shortcuts";

/**
 * Raccourcis du navigateur intégré (WebView2) qui n'ont pas de sens dans une app
 * desktop. Recharger la page, surtout, effacerait l'état des lancements en cours
 * alors que leurs commandes continueraient de tourner.
 */
const BROWSER_SHORTCUTS: readonly Shortcut[] = [
  // Recharger
  { key: "F5" },
  { key: "F5", shift: true },
  { key: "F5", mod: true },
  { key: "r", mod: true },
  { key: "r", mod: true, shift: true },
  { key: "BrowserRefresh" },
  // Imprimer
  { key: "p", mod: true },
  { key: "p", mod: true, shift: true },
  // Rechercher dans la page
  { key: "f", mod: true },
  { key: "g", mod: true },
  { key: "g", mod: true, shift: true },
  { key: "F3" },
  { key: "F3", shift: true },
  // Historique (l'app n'a qu'une page)
  { key: "BrowserBack" },
  { key: "BrowserForward" },
];

export function isBrowserShortcut(event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey">, mac?: boolean): boolean {
  return BROWSER_SHORTCUTS.some((shortcut) => matchesShortcut(event, shortcut, mac));
}
