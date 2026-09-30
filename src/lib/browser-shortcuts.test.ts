import { describe, expect, it } from "vitest";
import { isBrowserShortcut } from "@/lib/browser-shortcuts";

const key = (key: string, modifiers: { ctrlKey?: boolean; shiftKey?: boolean } = {}) => ({
  key,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...modifiers,
});

describe("isBrowserShortcut", () => {
  it("reconnaît recharger, imprimer et rechercher dans la page", () => {
    for (const event of [key("F5"), key("r", { ctrlKey: true }), key("R", { ctrlKey: true, shiftKey: true }), key("p", { ctrlKey: true }), key("f", { ctrlKey: true })]) {
      expect(isBrowserShortcut(event, false), event.key).toBe(true);
    }
  });

  it("laisse passer l'édition de texte et les raccourcis de l'application", () => {
    for (const event of [key("c", { ctrlKey: true }), key("v", { ctrlKey: true }), key("z", { ctrlKey: true }), key("a", { ctrlKey: true }), key("s", { ctrlKey: true }), key("n", { ctrlKey: true }), key("r")]) {
      expect(isBrowserShortcut(event, false), event.key).toBe(false);
    }
  });
});
