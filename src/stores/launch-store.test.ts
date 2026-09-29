import { describe, expect, it } from "vitest";
import { createLaunchEngine } from "@/domain/launch/engine";
import { createFakeSystem } from "@/domain/launch/fake-system";
import { demoPresets } from "@/domain/preset/fixtures";
import { createLaunchStore } from "@/stores/launch-store";

// Le comportement du lancement est testé sur le moteur (domain/launch/engine.test.ts).
// Ici, on vérifie seulement le pont : le store reflète le moteur et lui délègue.
describe("launch store", () => {
  it("reflète l'état du moteur après chaque action", async () => {
    const preset = demoPresets[1];
    if (!preset) throw new Error("preset de démonstration manquant");
    const engine = createLaunchEngine(createFakeSystem().system);
    const store = createLaunchStore(engine);

    await store.getState().launchPreset(preset);

    expect(store.getState().runs).toBe(engine.getRuns());
    expect(store.getState().runs[preset.id]?.inProgress).toBe(false);
  });
});
