import { applyItemRunEvent, createItemRun, type ItemRun, type ItemRunEvent } from "@/domain/launch/item-run";
import {
  buildLaunchReport,
  planLaunch,
  type ItemResolver,
  type LaunchReport,
} from "@/domain/launch/pipeline";
import { runItem } from "@/domain/launch/run-item";
import type { SystemAdapter } from "@/domain/launch/system-adapter";
import { SYSTEM_CALL_TIMEOUT_MS, withTimeouts } from "@/domain/launch/timeout";
import type { Preset } from "@/domain/preset/schema";
import { errorMessage } from "@/lib/errors";

/**
 * Moteur de lancement : orchestre les étapes du pipeline et conserve l'état
 * des lancements. Aucune dépendance à React, Zustand ou Tauri : l'interface
 * s'y abonne, les tests l'utilisent directement avec un faux système.
 */

/** Dernier lancement d'un preset. */
export interface LaunchRun {
  presetId: string;
  startedAt: string;
  /** Fin de la séquence (les commandes peuvent encore tourner). */
  finishedAt?: string;
  inProgress: boolean;
  items: Record<string, ItemRun>;
}

export type LaunchRuns = Readonly<Record<string, LaunchRun>>;

export interface LaunchOptions {
  resolve?: ItemResolver;
}

export interface LaunchEngine {
  getRuns(): LaunchRuns;
  /** Appelé à chaque changement ; renvoie la fonction de désabonnement. */
  subscribe(listener: (runs: LaunchRuns) => void): () => void;
  /** Lance le preset. `undefined` si un lancement de ce preset est déjà en cours. */
  launchPreset(preset: Preset, options?: LaunchOptions): Promise<LaunchReport | undefined>;
  /** Lance un seul item, même désactivé (test isolé). */
  launchItem(preset: Preset, itemId: string, options?: LaunchOptions): Promise<void>;
  stopItem(presetId: string, itemId: string): Promise<void>;
  stopAllItems(presetId: string): Promise<void>;
  /** Oublie le lancement, s'il n'a plus rien en cours. */
  clearRun(presetId: string): void;
}

export interface EngineOptions {
  now?: () => Date;
  timeoutMs?: number;
}

export function createLaunchEngine(system: SystemAdapter, options: EngineOptions = {}): LaunchEngine {
  const { now = () => new Date(), timeoutMs = SYSTEM_CALL_TIMEOUT_MS } = options;
  const timedSystem = withTimeouts(system, timeoutMs);
  const listeners = new Set<(runs: LaunchRuns) => void>();
  // État immuable : chaque changement produit de nouveaux objets, ce qui permet
  // à l'interface de détecter ce qui a changé par simple comparaison de références.
  let runs: LaunchRuns = {};

  function commit(next: LaunchRuns) {
    runs = next;
    for (const listener of listeners) listener(runs);
  }

  function updateRun(presetId: string, update: (run: LaunchRun) => LaunchRun) {
    const run = runs[presetId];
    if (run) commit({ ...runs, [presetId]: update(run) });
  }

  function setItem(presetId: string, itemId: string, itemRun: ItemRun) {
    updateRun(presetId, (run) => ({ ...run, items: { ...run.items, [itemId]: itemRun } }));
  }

  function apply(presetId: string, itemId: string, event: ItemRunEvent) {
    const current = runs[presetId]?.items[itemId] ?? createItemRun(itemId);
    setItem(presetId, itemId, applyItemRunEvent(current, event));
  }

  const isRunning = (itemRun: ItemRun | undefined) => itemRun?.status === "running";

  const engine: LaunchEngine = {
    getRuns: () => runs,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    async launchPreset(preset, launchOptions = {}) {
      const previous = runs[preset.id];
      if (previous?.inProgress) return undefined;
      const startedAt = now();

      // 1-3. Résoudre, valider, planifier
      const steps = planLaunch(preset.items, { resolve: launchOptions.resolve, previous: previous?.items });
      commit({
        ...runs,
        [preset.id]: {
          presetId: preset.id,
          startedAt: startedAt.toISOString(),
          inProgress: true,
          items: Object.fromEntries(steps.map((step) => [step.item.id, step.initial])),
        },
      });

      // 4. Exécuter, dans l'ordre. L'échec d'un item n'arrête pas les suivants.
      for (const step of steps) {
        if (step.execute) {
          await runItem(step.item, timedSystem, (event) => apply(preset.id, step.item.id, event));
        }
      }

      // 5. Collecter et rapporter
      const finishedAt = now();
      updateRun(preset.id, (run) => ({ ...run, inProgress: false, finishedAt: finishedAt.toISOString() }));
      return buildLaunchReport(preset, runs[preset.id]?.items ?? {}, startedAt, finishedAt);
    },

    async launchItem(preset, itemId, launchOptions = {}) {
      const item = preset.items.find((candidate) => candidate.id === itemId);
      const run = runs[preset.id];
      if (!item || run?.inProgress || isRunning(run?.items[itemId])) return;

      if (!run) {
        commit({
          ...runs,
          [preset.id]: { presetId: preset.id, startedAt: now().toISOString(), inProgress: false, items: {} },
        });
      }
      // Même pipeline qu'un lancement complet, sur ce seul item (activé pour l'occasion).
      const [step] = planLaunch([{ ...item, enabled: true }], { resolve: launchOptions.resolve });
      if (!step) return;
      setItem(preset.id, itemId, step.initial);
      if (step.execute) {
        await runItem(step.item, timedSystem, (event) => apply(preset.id, itemId, event));
      }
    },

    async stopItem(presetId, itemId) {
      const itemRun = runs[presetId]?.items[itemId];
      if (!isRunning(itemRun) || itemRun?.processId === undefined || itemRun.stopRequested) return;

      apply(presetId, itemId, { type: "stop-requested" });
      try {
        await timedSystem.stopProcess(itemRun.processId);
      } catch (error) {
        apply(presetId, itemId, { type: "stop-failed", error: `Couldn’t stop the command: ${errorMessage(error)}` });
      }
    },

    async stopAllItems(presetId) {
      const run = runs[presetId];
      if (!run) return;
      const running = Object.values(run.items).filter(isRunning);
      await Promise.all(running.map((itemRun) => engine.stopItem(presetId, itemRun.itemId)));
    },

    clearRun(presetId) {
      const run = runs[presetId];
      if (!run || run.inProgress || Object.values(run.items).some(isRunning)) return;
      const { [presetId]: _removed, ...rest } = runs;
      commit(rest);
    },
  };

  return engine;
}
