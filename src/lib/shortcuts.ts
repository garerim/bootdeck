/** Raccourci clavier, décrit indépendamment de l'OS. */
export interface Shortcut {
  /** Valeur de `KeyboardEvent.key` : "n", "Enter", "Escape", ","… (lettres sans casse). */
  key: string;
  /** Ctrl sous Windows et Linux, ⌘ sous macOS. */
  mod?: boolean;
  shift?: boolean;
}

type KeyEvent = Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey">;

export function isMac(): boolean {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);
}

/**
 * Vrai si l'événement correspond exactement au raccourci : `Ctrl+Shift+S` ne
 * déclenche pas `Ctrl+S`. Alt est toujours exclu (AltGr = Ctrl+Alt sous Windows).
 */
export function matchesShortcut(event: KeyEvent, shortcut: Shortcut, mac = isMac()): boolean {
  const mod = mac ? event.metaKey : event.ctrlKey;
  const otherMod = mac ? event.ctrlKey : event.metaKey;
  return (
    event.key.toLowerCase() === shortcut.key.toLowerCase() &&
    mod === (shortcut.mod ?? false) &&
    event.shiftKey === (shortcut.shift ?? false) &&
    !otherMod &&
    !event.altKey
  );
}

const KEY_LABELS: Readonly<Record<string, string>> = { Enter: "Enter", Escape: "Esc" };

/** Libellé affichable : `Ctrl+Shift+N` sous Windows, `⌘⇧N` sous macOS. */
export function formatShortcut(shortcut: Shortcut, mac = isMac()): string {
  const parts: string[] = [];
  if (shortcut.mod) parts.push(mac ? "⌘" : "Ctrl");
  if (shortcut.shift) parts.push(mac ? "⇧" : "Shift");
  parts.push(KEY_LABELS[shortcut.key] ?? shortcut.key.toUpperCase());
  return parts.join(mac ? "" : "+");
}

/** `Save changes (Ctrl+S)` : le raccourci rappelé dans l'infobulle d'un bouton. */
export function withShortcut(label: string, shortcut: Shortcut): string {
  return `${label} (${formatShortcut(shortcut)})`;
}

/** Raccourcis de l'application : une seule liste, reprise dans les infobulles et les réglages. */
export const SHORTCUTS = {
  newPreset: { key: "n", mod: true },
  save: { key: "s", mod: true },
  launch: { key: "Enter", mod: true },
  back: { key: "Escape" },
  settings: { key: ",", mod: true },
} as const satisfies Record<string, Shortcut>;

export const SHORTCUT_HELP: readonly { shortcut: Shortcut; description: string }[] = [
  { shortcut: SHORTCUTS.newPreset, description: "New preset" },
  { shortcut: SHORTCUTS.save, description: "Save the preset being edited" },
  { shortcut: SHORTCUTS.launch, description: "Launch the preset on screen" },
  { shortcut: SHORTCUTS.back, description: "Cancel editing, or go back to the list" },
  { shortcut: SHORTCUTS.settings, description: "Open settings" },
];
