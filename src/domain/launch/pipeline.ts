import { createItemRun, summarizeItemRuns, type ItemRun, type RunSummary } from "@/domain/launch/item-run";
import { PresetItemSchema, type Preset, type PresetItem } from "@/domain/preset/schema";

/**
 * Étapes pures du lancement, testables une à une :
 *
 *   Preset → résoudre → valider → planifier (ordre + état initial) → [exécuter] → rapport
 *
 * L'exécution, qui a des effets de bord, est orchestrée par le moteur (`engine.ts`).
 */

/** Résultat d'une étape pour un item : l'item (éventuellement transformé) ou la raison du refus. */
export type ItemCheck = { ok: true; item: PresetItem } | { ok: false; error: string };

// ─── 1. Résolution ─────────────────────────────────────────────────────────────

/**
 * Transforme un item avant son lancement. Aujourd'hui l'identité ; en Phase 8,
 * c'est ici que `~/Projects/{project}` deviendra `~/Projects/my-saas`.
 */
export type ItemResolver = (item: PresetItem) => ItemCheck;

export const identityResolver: ItemResolver = (item) => ({ ok: true, item });

// ─── 2. Validation ─────────────────────────────────────────────────────────────

/**
 * Validation au moment du lancement, sur la valeur *résolue*. Le schéma du
 * stockage validera des modèles (`http://localhost:{port}`) ; ici on vérifie
 * ce qui partira réellement vers le système.
 */
export function validateItem(item: PresetItem): ItemCheck {
  const result = PresetItemSchema.safeParse(item);
  if (result.success) return { ok: true, item: result.data };
  const message = result.error.issues[0]?.message ?? "invalid value";
  return { ok: false, error: `Not launched: ${message}.` };
}

// ─── 3. Plan ───────────────────────────────────────────────────────────────────

export interface LaunchStep {
  /** Item tel qu'il sera exécuté (résolu et validé). */
  item: PresetItem;
  /** État de l'item au début du lancement. */
  initial: ItemRun;
  /** Faux : l'item est ignoré, déjà actif, ou refusé avant exécution. */
  execute: boolean;
}

export interface PlanOptions {
  resolve?: ItemResolver;
  /** États d'un lancement précédent, pour ne pas relancer une commande encore active. */
  previous?: Readonly<Record<string, ItemRun>>;
}

/**
 * Ordre d'exécution = ordre choisi par l'utilisateur dans le preset. Chaque
 * item reçoit son état initial ; seuls les items `pending` seront exécutés.
 */
export function planLaunch(items: readonly PresetItem[], options: PlanOptions = {}): LaunchStep[] {
  const { resolve = identityResolver, previous = {} } = options;

  return items.map((item): LaunchStep => {
    const earlier = previous[item.id];
    // Une commande encore active (ex. `npm run dev`) est conservée : la relancer
    // créerait un second serveur sur le même port.
    if (item.type === "command" && earlier?.status === "running") {
      return { item, initial: earlier, execute: false };
    }
    if (!item.enabled) {
      return { item, initial: createItemRun(item.id, "skipped"), execute: false };
    }

    const resolved = resolve(item);
    const checked = resolved.ok ? validateItem(resolved.item) : resolved;
    if (!checked.ok) {
      return { item, initial: { ...createItemRun(item.id), status: "failed", error: checked.error }, execute: false };
    }
    return { item: checked.item, initial: createItemRun(item.id), execute: true };
  });
}

// ─── 4. Rapport ────────────────────────────────────────────────────────────────

export interface LaunchReport {
  presetId: string;
  presetName: string;
  startedAt: string;
  /** Fin de la séquence : les commandes lancées peuvent encore tourner. */
  finishedAt: string;
  durationMs: number;
  /** Dans l'ordre du preset. */
  items: ItemRun[];
  summary: RunSummary;
}

export function buildLaunchReport(
  preset: Preset,
  items: Readonly<Record<string, ItemRun>>,
  startedAt: Date,
  finishedAt: Date,
): LaunchReport {
  const ordered = preset.items
    .map((item) => items[item.id])
    .filter((run): run is ItemRun => run !== undefined);
  return {
    presetId: preset.id,
    presetName: preset.name,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    items: ordered,
    summary: summarizeItemRuns(ordered),
  };
}
