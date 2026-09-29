import { describe, expect, it } from "vitest";
import { createFakeSystem } from "@/domain/launch/fake-system";
import { demoPresets } from "@/domain/preset/fixtures";
import type { Preset } from "@/domain/preset/schema";
import { createLaunchStore } from "@/stores/launch-store";

function demoPreset(index: number): Preset {
  const preset = demoPresets[index];
  if (!preset) throw new Error(`Aucun preset de démonstration à l'index ${index}`);
  return structuredClone(preset);
}

const devSaas = demoPreset(0); // 2 apps, 1 commande (index 2), 4 URLs
const design = demoPreset(2); // Storybook désactivé (index 2)
const commandId = devSaas.items[2]?.id ?? "";

function statuses(store: ReturnType<typeof createLaunchStore>, preset: Preset): string[] {
  const run = store.getState().runs[preset.id];
  return preset.items.map((item) => run?.items[item.id]?.status ?? "none");
}

describe("launch store", () => {
  it("lance tous les items : la commande reste en cours, les autres réussissent", async () => {
    const fake = createFakeSystem();
    const store = createLaunchStore(fake.system);
    await store.getState().launchPreset(devSaas);

    expect(statuses(store, devSaas)).toEqual([
      "success",
      "success",
      "running",
      "success",
      "success",
      "success",
      "success",
    ]);
    expect(store.getState().runs[devSaas.id]?.inProgress).toBe(false);

    fake.emit(1, { type: "exited", code: 0 });
    expect(statuses(store, devSaas)[2]).toBe("success");
  });

  it("marque les items désactivés comme ignorés sans les lancer", async () => {
    const fake = createFakeSystem();
    const store = createLaunchStore(fake.system);
    await store.getState().launchPreset(design);

    expect(statuses(store, design)).toEqual(["success", "success", "skipped"]);
    expect(fake.calls).not.toContain("url http://localhost:6006");
  });

  it("arrête une commande à la demande : statut stopped, pas failed", async () => {
    const fake = createFakeSystem();
    const store = createLaunchStore(fake.system);
    await store.getState().launchPreset(devSaas);
    await store.getState().stopItem(devSaas.id, commandId);

    expect(fake.calls).toContain("stop 1");
    expect(statuses(store, devSaas)[2]).toBe("stopped");
  });

  it("ne relance pas une commande encore active (pas de second serveur sur le même port)", async () => {
    const fake = createFakeSystem();
    const store = createLaunchStore(fake.system);
    await store.getState().launchPreset(devSaas);
    await store.getState().launchPreset(devSaas);

    expect(fake.calls.filter((call) => call.startsWith("command "))).toHaveLength(1);
    expect(statuses(store, devSaas)[2]).toBe("running");
    expect(store.getState().runs[devSaas.id]?.items[commandId]?.processId).toBe(1);
  });

  it("lance un seul item sans toucher aux autres", async () => {
    const fake = createFakeSystem();
    const store = createLaunchStore(fake.system);
    await store.getState().launchItem(devSaas, devSaas.items[4]?.id ?? "");

    expect(fake.calls).toEqual(["url https://supabase.com/dashboard"]);
    expect(statuses(store, devSaas)).toEqual(["none", "none", "none", "none", "success", "none", "none"]);
  });

  it("ne peut effacer le résultat tant qu'une commande tourne", async () => {
    const fake = createFakeSystem();
    const store = createLaunchStore(fake.system);
    await store.getState().launchPreset(devSaas);

    store.getState().clearRun(devSaas.id);
    expect(store.getState().runs[devSaas.id]).toBeDefined();

    await store.getState().stopItem(devSaas.id, commandId);
    store.getState().clearRun(devSaas.id);
    expect(store.getState().runs[devSaas.id]).toBeUndefined();
  });
});
