import { describe, expect, it } from "vitest";
import { demoPresets } from "@/domain/preset/fixtures";
import {
  MAX_ITEMS_PER_PRESET,
  PRESET_ITEM_TYPES,
  PresetItemSchema,
  PresetSchema,
  type Preset,
  type PresetItem,
} from "@/domain/preset/schema";

function demoPreset(index = 0): Preset {
  const preset = demoPresets[index];
  if (!preset) throw new Error(`Aucun preset de démonstration à l'index ${index}`);
  return structuredClone(preset);
}

function urlItem(id: string = crypto.randomUUID()): PresetItem {
  return { id, type: "url", name: "Docs", enabled: true, config: { url: "https://example.com" } };
}

describe("PresetSchema", () => {
  it.each(demoPresets.map((preset) => [preset.name, preset] as const))(
    "le preset de démonstration « %s » est valide et inchangé par la validation",
    (_name, preset) => {
      expect(PresetSchema.parse(preset)).toEqual(preset);
    },
  );

  it("supprime les espaces autour du nom", () => {
    expect(PresetSchema.parse({ ...demoPreset(), name: "  Dev SaaS  " }).name).toBe("Dev SaaS");
  });

  it("refuse un nom vide ou composé d'espaces", () => {
    const result = PresetSchema.safeParse({ ...demoPreset(), name: "   " });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({ path: ["name"], message: "Name is required" });
  });

  it("refuse un id qui n'est pas un UUID", () => {
    expect(PresetSchema.safeParse({ ...demoPreset(), id: "preset-1" }).success).toBe(false);
  });

  it("refuse une date qui n'est pas au format ISO 8601", () => {
    expect(PresetSchema.safeParse({ ...demoPreset(), createdAt: "hier" }).success).toBe(false);
  });

  it("accepte un preset sans aucun item", () => {
    expect(PresetSchema.safeParse({ ...demoPreset(), items: [] }).success).toBe(true);
  });

  it(`refuse plus de ${MAX_ITEMS_PER_PRESET} items`, () => {
    const items = Array.from({ length: MAX_ITEMS_PER_PRESET + 1 }, () => urlItem());
    expect(PresetSchema.safeParse({ ...demoPreset(), items }).success).toBe(false);
  });

  it("refuse deux items avec le même id et désigne le doublon", () => {
    const id = crypto.randomUUID();
    const result = PresetSchema.safeParse({ ...demoPreset(), items: [urlItem(id), urlItem(id)] });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({ path: ["items", 1, "id"], message: "Duplicate item id" });
  });

  it("retire les champs inconnus au lieu de les conserver", () => {
    const parsed = PresetSchema.parse({ ...demoPreset(), injected: "<script>" });
    expect(parsed).not.toHaveProperty("injected");
  });
});

describe("PresetItemSchema", () => {
  it("expose les 4 types d'items dans l'ordre d'affichage", () => {
    expect(PRESET_ITEM_TYPES).toEqual(["application", "url", "folder", "command"]);
  });

  it("refuse un type inconnu", () => {
    expect(PresetItemSchema.safeParse({ ...urlItem(), type: "script" }).success).toBe(false);
  });

  it("refuse une config qui ne correspond pas au type", () => {
    const folderConfigOnUrl = { ...urlItem(), config: { path: "C:\\Projects" } };
    expect(PresetItemSchema.safeParse(folderConfigOnUrl).success).toBe(false);
  });

  it("accepte une application sans dossier de travail", () => {
    const item = {
      id: crypto.randomUUID(),
      type: "application",
      name: "Notes",
      enabled: true,
      config: { path: "notepad.exe", args: [] },
    };
    expect(PresetItemSchema.safeParse(item).success).toBe(true);
  });

  it("refuse une commande sur plusieurs lignes", () => {
    const item = {
      id: crypto.randomUUID(),
      type: "command",
      name: "Dev server",
      enabled: true,
      config: { command: "npm run dev\nshutdown /s" },
    };
    expect(PresetItemSchema.safeParse(item).success).toBe(false);
  });
});
