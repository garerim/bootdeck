import { describe, expect, it } from "vitest";
import { demoPresets } from "@/domain/preset/fixtures";
import type { Preset } from "@/domain/preset/schema";
import { parsePresetsFile, serializePresetsFile } from "@/domain/preset/serialization";
import type { PresetStorage } from "@/domain/preset/storage";
import { createMemoryPresetStorage } from "@/platform/mock/memory-preset-storage";
import { createPresetsStore } from "@/stores/presets-store";

function demoPreset(index = 0): Preset {
  const preset = demoPresets[index];
  if (!preset) throw new Error(`Aucun preset de démonstration à l'index ${index}`);
  return structuredClone(preset);
}

/** Stockage en mémoire qui garde la trace de ce qui a été écrit. */
function spyStorage(initialContent: string | null) {
  const memory = createMemoryPresetStorage(initialContent);
  const written: string[] = [];
  const storage: PresetStorage = {
    ...memory,
    write: async (content) => {
      written.push(content);
      await memory.write(content);
    },
  };
  return { storage, written };
}

function savedNames(content: string | undefined): string[] {
  const parsed = parsePresetsFile(content ?? "");
  if (!parsed.ok) throw new Error("Le contenu écrit devrait être un fichier valide");
  return parsed.file.presets.map((preset) => preset.name);
}

async function readyStore(initialContent: string | null = serializePresetsFile(demoPresets)) {
  const spy = spyStorage(initialContent);
  const store = createPresetsStore(spy.storage);
  await store.getState().initialize();
  return { store, ...spy };
}

describe("presets store — chargement", () => {
  it("charge les presets et l'emplacement du fichier", async () => {
    const { store } = await readyStore();
    expect(store.getState()).toMatchObject({
      load: { status: "ready" },
      presets: demoPresets,
      filePath: "memory://presets.json",
    });
  });

  it("démarre avec une liste vide au premier lancement", async () => {
    const { store } = await readyStore(null);
    expect(store.getState()).toMatchObject({ load: { status: "ready" }, presets: [] });
  });

  it("passe en erreur sur un fichier illisible", async () => {
    const { store } = await readyStore("{ corrupted");
    expect(store.getState().load).toMatchObject({ status: "error", error: { kind: "invalid-json" } });
  });
});

describe("presets store — sauvegarde", () => {
  it("enregistre chaque modification", async () => {
    const { store, written } = await readyStore();
    store.getState().remove(demoPreset(1).id);
    await store.getState().flush();

    expect(written).toHaveLength(1);
    expect(savedNames(written[0])).toEqual(["Dev SaaS", "Design Handoff", "Next.js project"]);
  });

  it("n'écrit JAMAIS après un échec de lecture, pour ne pas écraser le fichier", async () => {
    const { store, written, storage } = await readyStore("{ corrupted");
    store.getState().save(demoPreset());
    store.getState().remove("any-id");
    expect(store.getState().duplicate("any-id")).toBeUndefined();
    await store.getState().retrySave();
    await store.getState().flush();

    expect(written).toEqual([]);
    expect((await storage.read()).content).toBe("{ corrupted");
  });

  it("écrit dans l'ordre des modifications, même si une écriture est lente", async () => {
    const { storage, written } = spyStorage(serializePresetsFile(demoPresets));
    let first = true;
    const slowFirstWrite: PresetStorage = {
      ...storage,
      write: async (content) => {
        if (first) {
          first = false;
          await new Promise((resolve) => setTimeout(resolve, 30));
        }
        await storage.write(content);
      },
    };
    const store = createPresetsStore(slowFirstWrite);
    await store.getState().initialize();

    store.getState().remove(demoPreset(0).id); // écriture lente
    store.getState().remove(demoPreset(1).id); // écriture rapide
    await store.getState().flush();

    expect(written.map(savedNames)).toEqual([
      ["Code Review", "Design Handoff", "Next.js project"],
      ["Design Handoff", "Next.js project"],
    ]);
  });

  it("signale un échec d'écriture, puis l'efface quand une sauvegarde réussit", async () => {
    const { storage } = spyStorage(serializePresetsFile(demoPresets));
    let failing = true;
    const flaky: PresetStorage = {
      ...storage,
      write: (content) => (failing ? Promise.reject(new Error("Disk full")) : storage.write(content)),
    };
    const store = createPresetsStore(flaky);
    await store.getState().initialize();

    store.getState().remove(demoPreset(0).id);
    await store.getState().flush();
    expect(store.getState().saveError).toBe("Disk full");

    failing = false;
    await store.getState().retrySave();
    expect(store.getState().saveError).toBeNull();
  });
});

describe("presets store — sauvegarde de secours", () => {
  it("met le fichier illisible de côté et repart d'une liste vide", async () => {
    const { store, storage } = await readyStore("{ corrupted");
    const result = await store.getState().backupAndReset();

    expect(result).toEqual({ ok: true });
    expect(store.getState()).toMatchObject({
      load: { status: "ready" },
      presets: [],
      notice: "Your previous presets file was kept as memory://presets.invalid-1.json",
    });
    expect((await storage.read()).content).toBeNull();
  });

  it("reste en erreur si la mise de côté échoue", async () => {
    const memory = createMemoryPresetStorage("{ corrupted");
    const store = createPresetsStore({ ...memory, backup: () => Promise.reject(new Error("Access denied")) });
    await store.getState().initialize();

    expect(await store.getState().backupAndReset()).toEqual({ ok: false, message: "Access denied" });
    expect(store.getState().load.status).toBe("error");
  });
});
