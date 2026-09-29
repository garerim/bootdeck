import { describe, expect, it } from "vitest";
import { demoPresets } from "@/domain/preset/fixtures";
import { serializePresetsFile } from "@/domain/preset/serialization";
import { loadPresets, savePresets } from "@/domain/preset/storage";
import type { FileStorage } from "@/domain/storage/file-storage";
import { createMemoryFileStorage } from "@/platform/mock/memory-file-storage";

describe("loadPresets", () => {
  it("renvoie une liste vide au premier lancement (pas de fichier)", async () => {
    const result = await loadPresets(createMemoryFileStorage(null));
    expect(result).toEqual({ ok: true, path: "memory://presets.json", presets: [] });
  });

  it("renvoie les presets d'un fichier valide", async () => {
    const result = await loadPresets(createMemoryFileStorage(serializePresetsFile(demoPresets)));
    expect(result).toEqual({ ok: true, path: "memory://presets.json", presets: demoPresets });
  });

  it("signale un fichier illisible en indiquant son emplacement", async () => {
    const result = await loadPresets(createMemoryFileStorage("{ corrupted"));
    expect(result).toMatchObject({ ok: false, path: "memory://presets.json", error: { kind: "invalid-json" } });
  });

  it("signale un fichier écrit par une version plus récente", async () => {
    const result = await loadPresets(createMemoryFileStorage('{ "schemaVersion": 7, "presets": [] }'));
    expect(result).toMatchObject({ ok: false, error: { kind: "unsupported-version", found: 7 } });
  });

  it("transforme un échec de lecture en erreur explicite", async () => {
    const failing: FileStorage = {
      ...createMemoryFileStorage(),
      read: () => Promise.reject(new Error("Could not read presets.json: access denied")),
    };
    const result = await loadPresets(failing);
    expect(result).toEqual({
      ok: false,
      path: null,
      error: { kind: "read-failed", message: "Could not read presets.json: access denied" },
    });
  });
});

describe("savePresets", () => {
  it("écrit le fichier versionné, relu à l'identique", async () => {
    const storage = createMemoryFileStorage();
    await savePresets(storage, demoPresets);
    expect(await loadPresets(storage)).toMatchObject({ ok: true, presets: demoPresets });
  });
});
