import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { createLaunchEngine, type LaunchEngine, type LaunchRuns } from "@/domain/launch/engine";
import type { Preset } from "@/domain/preset/schema";
import { createSystemAdapter } from "@/platform/system-adapter";

export type { LaunchRun } from "@/domain/launch/engine";

/**
 * Pont entre le moteur de lancement (domaine) et React : le store reflète
 * l'état du moteur et délègue les actions. Toute la logique est dans le moteur.
 */
export interface LaunchState {
  runs: LaunchRuns;
  launchPreset: (preset: Preset) => Promise<void>;
  launchItem: (preset: Preset, itemId: string) => Promise<void>;
  stopItem: (presetId: string, itemId: string) => Promise<void>;
  stopAllItems: (presetId: string) => Promise<void>;
  clearRun: (presetId: string) => void;
}

export function createLaunchStore(engine: LaunchEngine) {
  const store = createStore<LaunchState>()(() => ({
    runs: engine.getRuns(),
    launchPreset: async (preset) => {
      await engine.launchPreset(preset);
    },
    launchItem: (preset, itemId) => engine.launchItem(preset, itemId),
    stopItem: (presetId, itemId) => engine.stopItem(presetId, itemId),
    stopAllItems: (presetId) => engine.stopAllItems(presetId),
    clearRun: (presetId) => engine.clearRun(presetId),
  }));
  engine.subscribe((runs) => store.setState({ runs }));
  return store;
}

/** Instance utilisée par l'application. */
export const launchStore = createLaunchStore(createLaunchEngine(createSystemAdapter()));

export function useLaunchStore<T>(selector: (state: LaunchState) => T): T {
  return useStore(launchStore, selector);
}
