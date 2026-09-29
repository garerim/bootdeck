import { describe, expect, it } from "vitest";
import { demoPresets } from "@/domain/preset/fixtures";
import type { Preset } from "@/domain/preset/schema";
import { parsePresetsFile, serializePresetsFile } from "@/domain/preset/serialization";

function demoPreset(index = 0): Preset {
  const preset = demoPresets[index];
  if (!preset) throw new Error(`Aucun preset de démonstration à l'index ${index}`);
  return structuredClone(preset);
}

describe("serializePresetsFile", () => {
  it("produit un JSON indenté et versionné", () => {
    const content = serializePresetsFile([]);
    expect(content).toBe('{\n  "schemaVersion": 1,\n  "presets": []\n}\n');
  });

  it("refuse d'écrire des données invalides", () => {
    const invalid = { ...demoPreset(), name: "" };
    expect(() => serializePresetsFile([invalid])).toThrow();
  });
});

describe("parsePresetsFile", () => {
  it("relit exactement ce qui a été écrit (aller-retour)", () => {
    const result = parsePresetsFile(serializePresetsFile(demoPresets));
    expect(result).toEqual({ ok: true, file: { schemaVersion: 1, presets: demoPresets } });
  });

  it("signale un JSON illisible sans lever d'exception", () => {
    const result = parsePresetsFile('{ "schemaVersion": 1, "presets": [');
    expect(result).toMatchObject({ ok: false, error: { kind: "invalid-json" } });
  });

  it("signale un fichier écrit par une version plus récente, sans le juger corrompu", () => {
    const fromTheFuture = JSON.stringify({ schemaVersion: 2, presets: [{ shape: "inconnue en v1" }] });
    const result = parsePresetsFile(fromTheFuture);
    expect(result).toEqual({
      ok: false,
      error: { kind: "unsupported-version", found: 2, expected: 1 },
    });
  });

  it("signale un fichier sans numéro de version", () => {
    const result = parsePresetsFile(JSON.stringify({ presets: [] }));
    expect(result).toMatchObject({
      ok: false,
      error: { kind: "invalid-data", issues: [{ path: "schemaVersion" }] },
    });
  });

  it("indique l'emplacement exact d'une valeur invalide", () => {
    const preset = demoPreset();
    preset.items = preset.items.map((item, index) =>
      index === 3 && item.type === "url" ? { ...item, config: { url: "javascript:alert(1)" } } : item,
    );
    const result = parsePresetsFile(JSON.stringify({ schemaVersion: 1, presets: [preset] }));
    expect(result).toEqual({
      ok: false,
      error: {
        kind: "invalid-data",
        issues: [{ path: "presets[0].items[3].config.url", message: "Must be an http:// or https:// URL" }],
      },
    });
  });

  it("refuse deux presets avec le même id", () => {
    const preset = demoPreset();
    const result = parsePresetsFile(JSON.stringify({ schemaVersion: 1, presets: [preset, preset] }));
    expect(result).toMatchObject({
      ok: false,
      error: { kind: "invalid-data", issues: [{ path: "presets[1].id", message: "Duplicate preset id" }] },
    });
  });
});
