import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import {
  applyItemRunEvent,
  createItemRun,
  type ItemRun,
  type ItemRunEvent,
} from "@/domain/launch/item-run";
import { runItem, runItems } from "@/domain/launch/run-items";
import type { SystemAdapter } from "@/domain/launch/system-adapter";
import type { Preset } from "@/domain/preset/schema";
import { errorMessage } from "@/lib/errors";
import { createSystemAdapter } from "@/platform/system-adapter";

/** Dernier lancement d'un preset (en mémoire : l'historique arrivera avec les sessions). */
export interface LaunchRun {
  presetId: string;
  startedAt: string;
  /** Vrai tant que la séquence de lancement n'est pas terminée. */
  inProgress: boolean;
  /** État de chaque item lancé, par id d'item. */
  items: Record<string, ItemRun>;
}

export interface LaunchState {
  runs: Record<string, LaunchRun>;
  /** Lance tous les items activés, dans l'ordre. */
  launchPreset: (preset: Preset) => Promise<void>;
  /** Lance un seul item (même désactivé) : utile pour tester un item isolément. */
  launchItem: (preset: Preset, itemId: string) => Promise<void>;
  stopItem: (presetId: string, itemId: string) => Promise<void>;
  /** Arrête toutes les commandes en cours du preset (ex. avant sa suppression). */
  stopAllItems: (presetId: string) => Promise<void>;
  /** Efface le résultat affiché, s'il n'y a plus rien en cours. */
  clearRun: (presetId: string) => void;
}

export function createLaunchStore(system: SystemAdapter) {
  return createStore<LaunchState>()((set, get) => {
    function apply(presetId: string, itemId: string, event: ItemRunEvent) {
      set((state) => {
        const run = state.runs[presetId];
        if (!run) return state;
        const current = run.items[itemId] ?? createItemRun(itemId);
        const items = { ...run.items, [itemId]: applyItemRunEvent(current, event) };
        return { runs: { ...state.runs, [presetId]: { ...run, items } } };
      });
    }

    function setRun(presetId: string, update: (run: LaunchRun | undefined) => LaunchRun) {
      set((state) => ({ runs: { ...state.runs, [presetId]: update(state.runs[presetId]) } }));
    }

    function patchRun(presetId: string, patch: Partial<LaunchRun>) {
      set((state) => {
        const run = state.runs[presetId];
        return run ? { runs: { ...state.runs, [presetId]: { ...run, ...patch } } } : state;
      });
    }

    const isRunning = (run: ItemRun | undefined) => run?.status === "running";

    return {
      runs: {},

      launchPreset: async (preset) => {
        const previous = get().runs[preset.id];
        if (previous?.inProgress) return;

        const items: Record<string, ItemRun> = {};
        for (const item of preset.items) {
          const stillRunning = previous?.items[item.id];
          // Une commande encore active d'un lancement précédent (ex. `npm run dev`) est
          // conservée telle quelle : la relancer créerait un doublon sur le même port.
          items[item.id] =
            item.type === "command" && stillRunning && isRunning(stillRunning)
              ? stillRunning
              : createItemRun(item.id, item.enabled ? "pending" : "skipped");
        }
        setRun(preset.id, () => ({
          presetId: preset.id,
          startedAt: new Date().toISOString(),
          inProgress: true,
          items,
        }));

        await runItems(
          preset.items,
          system,
          (itemId, event) => apply(preset.id, itemId, event),
          (item) => get().runs[preset.id]?.items[item.id]?.status === "pending",
        );
        patchRun(preset.id, { inProgress: false });
      },

      launchItem: async (preset, itemId) => {
        const item = preset.items.find((candidate) => candidate.id === itemId);
        const run = get().runs[preset.id];
        if (!item || run?.inProgress || isRunning(run?.items[itemId])) return;

        setRun(preset.id, (current) =>
          current ?? { presetId: preset.id, startedAt: new Date().toISOString(), inProgress: false, items: {} },
        );
        await runItem(item, system, (event) => apply(preset.id, itemId, event));
      },

      stopItem: async (presetId, itemId) => {
        const itemRun = get().runs[presetId]?.items[itemId];
        if (!isRunning(itemRun) || itemRun?.processId === undefined || itemRun.stopRequested) return;

        apply(presetId, itemId, { type: "stop-requested" });
        try {
          await system.stopProcess(itemRun.processId);
        } catch (error) {
          apply(presetId, itemId, { type: "stop-failed", error: `Couldn’t stop the command: ${errorMessage(error)}` });
        }
      },

      stopAllItems: async (presetId) => {
        const run = get().runs[presetId];
        if (!run) return;
        const running = Object.values(run.items).filter(isRunning);
        await Promise.all(running.map((itemRun) => get().stopItem(presetId, itemRun.itemId)));
      },

      clearRun: (presetId) => {
        const run = get().runs[presetId];
        if (!run || run.inProgress || Object.values(run.items).some(isRunning)) return;
        set((state) => {
          const { [presetId]: _removed, ...runs } = state.runs;
          return { runs };
        });
      },
    };
  });
}

/** Instance utilisée par l'application. */
export const launchStore = createLaunchStore(createSystemAdapter());

export function useLaunchStore<T>(selector: (state: LaunchState) => T): T {
  return useStore(launchStore, selector);
}
