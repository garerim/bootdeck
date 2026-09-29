import { describe, expect, it } from "vitest";
import { demoPresets } from "@/domain/preset/fixtures";
import { countItemsByType, duplicatePreset } from "@/domain/preset/operations";
import { PRESET_NAME_MAX_LENGTH, PresetSchema, type Preset } from "@/domain/preset/schema";

function demoPreset(index = 0): Preset {
  const preset = demoPresets[index];
  if (!preset) throw new Error(`Aucun preset de démonstration à l'index ${index}`);
  return structuredClone(preset);
}

/** Générateur d'ids déterministe : 00000000-0000-4000-8000-000000000001, …002, … */
function sequentialIds(): () => string {
  let next = 0;
  return () => `00000000-0000-4000-8000-${String(++next).padStart(12, "0")}`;
}

const NOW = new Date("2026-09-29T12:00:00.000Z");

describe("countItemsByType", () => {
  it("compte les items de chaque type, y compris les types absents", () => {
    expect(countItemsByType(demoPreset(0).items)).toEqual({
      application: 2,
      url: 4,
      folder: 0,
      command: 1,
    });
  });

  it("renvoie des zéros pour une liste vide", () => {
    expect(countItemsByType([])).toEqual({ application: 0, url: 0, folder: 0, command: 0 });
  });
});

describe("duplicatePreset", () => {
  it("crée une copie avec de nouveaux ids, de nouvelles dates et un nom suffixé", () => {
    const original = demoPreset();
    const copy = duplicatePreset(original, { now: NOW, newId: sequentialIds() });

    expect(copy.id).toBe("00000000-0000-4000-8000-000000000001");
    expect(copy.name).toBe("Dev SaaS (copy)");
    expect(copy.createdAt).toBe(NOW.toISOString());
    expect(copy.updatedAt).toBe(NOW.toISOString());
    expect(copy.items.map((item) => item.id)).toEqual(
      original.items.map((_, index) => `00000000-0000-4000-8000-${String(index + 2).padStart(12, "0")}`),
    );
    // Contenu identique en dehors des ids
    expect(copy.items.map(({ id: _id, ...rest }) => rest)).toEqual(
      original.items.map(({ id: _id, ...rest }) => rest),
    );
  });

  it("produit un preset valide", () => {
    const copy = duplicatePreset(demoPreset(), { now: NOW, newId: sequentialIds() });
    expect(PresetSchema.safeParse(copy).success).toBe(true);
  });

  it("tronque un nom trop long pour que la copie reste valide", () => {
    const original = { ...demoPreset(), name: "x".repeat(PRESET_NAME_MAX_LENGTH) };
    const copy = duplicatePreset(original, { now: NOW, newId: sequentialIds() });

    expect(copy.name).toHaveLength(PRESET_NAME_MAX_LENGTH);
    expect(copy.name.endsWith(" (copy)")).toBe(true);
    expect(PresetSchema.safeParse(copy).success).toBe(true);
  });

  it("ne partage aucune donnée avec l'original", () => {
    const original = demoPreset();
    const copy = duplicatePreset(original, { now: NOW, newId: sequentialIds() });
    const copiedApp = copy.items[0];
    if (copiedApp?.type !== "application") throw new Error("Le premier item de Dev SaaS doit être une application");

    copiedApp.config.args.push("--new-window");

    const originalApp = original.items[0];
    expect(originalApp?.type === "application" && originalApp.config.args).toEqual(["."]);
  });
});
