import { describe, expect, it } from "vitest";
import { formatShortcut, matchesShortcut } from "@/lib/shortcuts";

function key(key: string, modifiers: Partial<Record<"ctrlKey" | "metaKey" | "shiftKey" | "altKey", boolean>> = {}) {
  return { key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...modifiers };
}

describe("matchesShortcut", () => {
  const save = { key: "s", mod: true };

  it("utilise Ctrl sous Windows et Linux, ⌘ sous macOS", () => {
    expect(matchesShortcut(key("s", { ctrlKey: true }), save, false)).toBe(true);
    expect(matchesShortcut(key("s", { metaKey: true }), save, false)).toBe(false);
    expect(matchesShortcut(key("s", { metaKey: true }), save, true)).toBe(true);
    expect(matchesShortcut(key("s", { ctrlKey: true }), save, true)).toBe(false);
  });

  it("exige exactement les modificateurs demandés", () => {
    expect(matchesShortcut(key("s"), save, false)).toBe(false);
    expect(matchesShortcut(key("S", { ctrlKey: true, shiftKey: true }), save, false)).toBe(false);
    // AltGr sous Windows = Ctrl + Alt : un caractère tapé avec AltGr n'est pas un raccourci.
    expect(matchesShortcut(key("s", { ctrlKey: true, altKey: true }), save, false)).toBe(false);
    expect(matchesShortcut(key("R", { ctrlKey: true, shiftKey: true }), { key: "r", mod: true, shift: true }, false)).toBe(
      true,
    );
  });

  it("ignore la casse des lettres (Verr. Maj.) mais pas les autres touches", () => {
    expect(matchesShortcut(key("S", { ctrlKey: true }), save, false)).toBe(true);
    expect(matchesShortcut(key("Escape"), { key: "Escape" }, false)).toBe(true);
    expect(matchesShortcut(key("Enter", { ctrlKey: true }), { key: "Enter" }, false)).toBe(false);
  });
});

describe("formatShortcut", () => {
  it("affiche le raccourci selon les conventions de l'OS", () => {
    expect(formatShortcut({ key: "n", mod: true }, false)).toBe("Ctrl+N");
    expect(formatShortcut({ key: "Enter", mod: true }, false)).toBe("Ctrl+Enter");
    expect(formatShortcut({ key: "r", mod: true, shift: true }, false)).toBe("Ctrl+Shift+R");
    expect(formatShortcut({ key: "Escape" }, false)).toBe("Esc");
    expect(formatShortcut({ key: ",", mod: true }, true)).toBe("⌘,");
  });
});
