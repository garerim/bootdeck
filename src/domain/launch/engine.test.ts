import { describe, expect, it } from "vitest";
import { createLaunchEngine, type LaunchEngine } from "@/domain/launch/engine";
import { createFakeSystem } from "@/domain/launch/fake-system";
import { demoPresets } from "@/domain/preset/fixtures";
import type { Preset, PresetItem } from "@/domain/preset/schema";

function demoPreset(index: number): Preset {
  const preset = demoPresets[index];
  if (!preset) throw new Error(`Aucun preset de démonstration à l'index ${index}`);
  return structuredClone(preset);
}

const devSaas = demoPreset(0); // 2 apps, 1 commande (index 2), 4 URLs
const design = demoPreset(2); // Storybook désactivé (index 2)
const commandId = devSaas.items[2]?.id ?? "";

/** Horloge qui avance d'une seconde à chaque lecture. */
function tickingClock(start = "2026-09-29T20:00:00.000Z") {
  let current = new Date(start).getTime();
  return () => {
    const date = new Date(current);
    current += 1000;
    return date;
  };
}

function statuses(engine: LaunchEngine, preset: Preset): string[] {
  const run = engine.getRuns()[preset.id];
  return preset.items.map((item) => run?.items[item.id]?.status ?? "none");
}

describe("launch engine — lancement complet", () => {
  it("lance tous les items : la commande reste en cours, les autres réussissent", async () => {
    const fake = createFakeSystem();
    const engine = createLaunchEngine(fake.system);
    await engine.launchPreset(devSaas);

    expect(statuses(engine, devSaas)).toEqual(["success", "success", "running", "success", "success", "success", "success"]);
    fake.emit(1, { type: "exited", code: 0 });
    expect(statuses(engine, devSaas)[2]).toBe("success");
  });

  it("renvoie un rapport : ordre du preset, résumé, horodatage et durée", async () => {
    const engine = createLaunchEngine(createFakeSystem().system, { now: tickingClock() });
    const report = await engine.launchPreset(devSaas);

    expect(report).toMatchObject({
      presetId: devSaas.id,
      presetName: "Dev SaaS",
      startedAt: "2026-09-29T20:00:00.000Z",
      finishedAt: "2026-09-29T20:00:01.000Z",
      durationMs: 1000,
      summary: { total: 7, success: 6, running: 1, failed: 0 },
    });
    expect(report?.items.map((item) => item.itemId)).toEqual(devSaas.items.map((item) => item.id));
  });

  it("marque les items désactivés comme ignorés sans les lancer", async () => {
    const fake = createFakeSystem();
    const engine = createLaunchEngine(fake.system);
    await engine.launchPreset(design);

    expect(statuses(engine, design)).toEqual(["success", "success", "skipped"]);
    expect(fake.calls).not.toContain("url http://localhost:6006");
  });

  it("continue après un échec", async () => {
    const fake = createFakeSystem({ launchApplication: () => Promise.reject(new Error("Program not found: code")) });
    const engine = createLaunchEngine(fake.system);
    const report = await engine.launchPreset(devSaas);

    expect(report?.summary).toMatchObject({ failed: 2, running: 1, success: 4 });
    expect(engine.getRuns()[devSaas.id]?.items[devSaas.items[0]?.id ?? ""]?.error).toBe("Program not found: code");
  });

  it("refuse un second lancement du même preset tant que le premier est en cours", async () => {
    const engine = createLaunchEngine(createFakeSystem().system);
    const first = engine.launchPreset(devSaas);
    expect(await engine.launchPreset(devSaas)).toBeUndefined();
    await first;
  });

  it("ne relance pas une commande encore active (pas de second serveur sur le même port)", async () => {
    const fake = createFakeSystem();
    const engine = createLaunchEngine(fake.system);
    await engine.launchPreset(devSaas);
    await engine.launchPreset(devSaas);

    expect(fake.calls.filter((call) => call.startsWith("command "))).toHaveLength(1);
    expect(engine.getRuns()[devSaas.id]?.items[commandId]).toMatchObject({ status: "running", processId: 1 });
  });

  it("prévient ses abonnés à chaque changement, et plus après désabonnement", async () => {
    const engine = createLaunchEngine(createFakeSystem().system);
    let notifications = 0;
    const unsubscribe = engine.subscribe(() => (notifications += 1));
    await engine.launchPreset(design);
    expect(notifications).toBeGreaterThan(0);

    const before = notifications;
    unsubscribe();
    engine.clearRun(design.id);
    expect(notifications).toBe(before);
  });
});

describe("launch engine — validation et résolution", () => {
  it("n'envoie jamais au système un item invalide au moment du lancement", async () => {
    const fake = createFakeSystem();
    const engine = createLaunchEngine(fake.system);
    const broken: PresetItem = {
      id: "0d7c7a5e-1d4b-4f53-9a8b-2c1e4c7b9f01",
      type: "url",
      name: "Broken",
      enabled: true,
      config: { url: "javascript:alert(1)" },
    };
    const preset = { ...demoPreset(1), items: [broken] };
    await engine.launchPreset(preset);

    expect(fake.calls).toEqual([]);
    expect(engine.getRuns()[preset.id]?.items[broken.id]).toMatchObject({
      status: "failed",
      error: "Not launched: Must be an http:// or https:// URL.",
    });
  });

  it("exécute la valeur transformée par le résolveur (point d'entrée des variables)", async () => {
    const fake = createFakeSystem();
    const engine = createLaunchEngine(fake.system);
    const preset = { ...devSaas, items: devSaas.items.filter((item) => item.type === "url").slice(0, 1) };
    await engine.launchPreset(preset, {
      resolve: (item) =>
        item.type === "url" ? { ok: true, item: { ...item, config: { url: "http://localhost:5173" } } } : { ok: true, item },
    });

    expect(fake.calls).toEqual(["url http://localhost:5173"]);
  });

  it("marque en échec, sans l'exécuter, un item que le résolveur refuse", async () => {
    const fake = createFakeSystem();
    const engine = createLaunchEngine(fake.system);
    const preset = { ...devSaas, items: devSaas.items.slice(3, 4) };
    await engine.launchPreset(preset, { resolve: () => ({ ok: false, error: "Unknown variable {port}." }) });

    expect(fake.calls).toEqual([]);
    expect(engine.getRuns()[preset.id]?.items[preset.items[0]?.id ?? ""]?.error).toBe("Unknown variable {port}.");
  });
});

describe("launch engine — robustesse", () => {
  it("un appel système qui ne répond jamais échoue au bout du délai, sans bloquer le lancement", async () => {
    const fake = createFakeSystem({ openFolder: () => new Promise(() => {}) });
    const engine = createLaunchEngine(fake.system, { timeoutMs: 50 });
    const preset = demoPreset(2); // Figma, Assets (dossier), Storybook désactivé
    const report = await engine.launchPreset(preset);

    expect(report?.summary).toMatchObject({ success: 1, failed: 1, skipped: 1 });
    expect(engine.getRuns()[preset.id]?.items[preset.items[1]?.id ?? ""]?.error).toBe(
      "No response from the system after 0.1 s.",
    );
    expect(engine.getRuns()[preset.id]?.inProgress).toBe(false);
  });
});

describe("launch engine — item seul, arrêt, effacement", () => {
  it("lance un seul item sans toucher aux autres, même s'il est désactivé", async () => {
    const fake = createFakeSystem();
    const engine = createLaunchEngine(fake.system);
    await engine.launchItem(design, design.items[2]?.id ?? "");

    expect(fake.calls).toEqual(["url http://localhost:6006"]);
    expect(statuses(engine, design)).toEqual(["none", "none", "success"]);
  });

  it("arrête une commande à la demande : statut stopped, pas failed", async () => {
    const fake = createFakeSystem();
    const engine = createLaunchEngine(fake.system);
    await engine.launchPreset(devSaas);
    await engine.stopItem(devSaas.id, commandId);

    expect(fake.calls).toContain("stop 1");
    expect(statuses(engine, devSaas)[2]).toBe("stopped");
  });

  it("n'efface le résultat qu'une fois plus rien en cours", async () => {
    const engine = createLaunchEngine(createFakeSystem().system);
    await engine.launchPreset(devSaas);

    engine.clearRun(devSaas.id);
    expect(engine.getRuns()[devSaas.id]).toBeDefined();

    await engine.stopAllItems(devSaas.id);
    engine.clearRun(devSaas.id);
    expect(engine.getRuns()[devSaas.id]).toBeUndefined();
  });
});
