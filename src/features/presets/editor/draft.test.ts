import { describe, expect, it } from "vitest";
import { demoPresets } from "@/domain/preset/fixtures";
import { MAX_ITEMS_PER_PRESET } from "@/domain/preset/schema";
import {
  emptyItemDraft,
  emptyPresetDraft,
  itemFieldKey,
  moveItem,
  presetToDraft,
  validateDraft,
  type PresetDraft,
} from "@/features/presets/editor/draft";

const NOW = new Date("2026-09-29T12:00:00.000Z");
const IDENTITY = { id: "11111111-1111-4111-8111-111111111111", createdAt: "2026-09-01T08:00:00.000Z" };
const ITEM_ID = "22222222-2222-4222-8222-222222222222";

function draftWith(overrides: Partial<PresetDraft>): PresetDraft {
  return { ...emptyPresetDraft(), name: "My preset", ...overrides };
}

describe("presetToDraft + validateDraft", () => {
  it.each(demoPresets.map((preset) => [preset.name, preset] as const))(
    "« %s » : le brouillon redonne exactement le preset (hors date de mise à jour)",
    (_name, preset) => {
      const result = validateDraft(presetToDraft(preset), preset, NOW);
      expect(result).toEqual({ ok: true, preset: { ...preset, updatedAt: NOW.toISOString() } });
    },
  );
});

describe("validateDraft", () => {
  it("conserve l'id et la date de création, met à jour updatedAt", () => {
    const result = validateDraft(draftWith({}), IDENTITY, NOW);
    expect(result).toMatchObject({
      ok: true,
      preset: { id: IDENTITY.id, createdAt: IDENTITY.createdAt, updatedAt: NOW.toISOString() },
    });
  });

  it("transforme les champs facultatifs vides en undefined (omis dans le JSON)", () => {
    const command = { ...emptyItemDraft("command", ITEM_ID), name: "Dev", command: "npm run dev", workingDirectory: "  " };
    const result = validateDraft(draftWith({ description: "  ", icon: "", items: [command] }), IDENTITY, NOW);

    if (!result.ok) throw new Error("Le brouillon devrait être valide");
    expect(result.preset.description).toBeUndefined();
    expect(result.preset.icon).toBeUndefined();
    expect(result.preset.items[0]).toEqual({
      id: ITEM_ID,
      type: "command",
      name: "Dev",
      enabled: true,
      config: { command: "npm run dev" },
    });
  });

  it("découpe le champ Arguments en tableau", () => {
    const app = { ...emptyItemDraft("application", ITEM_ID), name: "Terminal", path: "wt", argumentsText: '-d "C:\\My Projects"' };
    const result = validateDraft(draftWith({ items: [app] }), IDENTITY, NOW);

    if (!result.ok) throw new Error("Le brouillon devrait être valide");
    expect(result.preset.items[0]).toMatchObject({ config: { args: ["-d", "C:\\My Projects"] } });
  });

  it("rattache l'erreur au champ du formulaire concerné", () => {
    const url = { ...emptyItemDraft("url", ITEM_ID), name: "Docs", url: "docs.example.com" };
    const result = validateDraft(draftWith({ name: " ", items: [url] }), IDENTITY, NOW);

    expect(result).toEqual({
      ok: false,
      errors: {
        name: "Name is required",
        [itemFieldKey(ITEM_ID, "url")]: "Must be an http:// or https:// URL",
      },
    });
  });

  it("rattache une erreur d'argument au champ texte Arguments", () => {
    const app = { ...emptyItemDraft("application", ITEM_ID), name: "App", path: "code", argumentsText: "x".repeat(5000) };
    const result = validateDraft(draftWith({ items: [app] }), IDENTITY, NOW);

    expect(result).toEqual({ ok: false, errors: { [itemFieldKey(ITEM_ID, "argumentsText")]: "Argument is too long" } });
  });

  it("signale un nombre d'items trop élevé au niveau de la liste", () => {
    const items = Array.from({ length: MAX_ITEMS_PER_PRESET + 1 }, (_, index) => ({
      ...emptyItemDraft("url", `33333333-3333-4333-8333-${String(index).padStart(12, "0")}`),
      name: "Docs",
      url: "https://example.com",
    }));
    const result = validateDraft(draftWith({ items }), IDENTITY, NOW);

    expect(result.ok).toBe(false);
    expect(!result.ok && Object.keys(result.errors)).toEqual(["items"]);
  });
});

describe("moveItem", () => {
  it.each([
    [0, 1, ["b", "a", "c"]],
    [2, -1, ["a", "c", "b"]],
    [0, -1, ["a", "b", "c"]],
    [2, 1, ["a", "b", "c"]],
  ])("déplace l'index %i de %i", (from, offset, expected) => {
    expect(moveItem(["a", "b", "c"], from, offset)).toEqual(expected);
  });
});
