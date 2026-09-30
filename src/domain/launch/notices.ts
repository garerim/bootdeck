import type { LaunchRuns } from "@/domain/launch/engine";
import { summarizeItemRuns } from "@/domain/launch/item-run";

/**
 * Ce qui mérite d'être signalé à l'utilisateur, même s'il regarde un autre écran.
 * Calculé en comparant deux états successifs des lancements : une fonction pure,
 * l'affichage (notification) est décidé ailleurs.
 */
export type LaunchNotice =
  /** La séquence de lancement d'un preset s'est terminée avec des échecs. */
  | { type: "launch-failed"; presetId: string; failed: number; launched: number }
  /**
   * Une commande qui tournait après la séquence (ex. serveur de dev) s'est
   * terminée en échec : c'est souvent là qu'un problème passe inaperçu.
   */
  | { type: "command-failed"; presetId: string; itemId: string; error: string };

export function detectLaunchNotices(previous: LaunchRuns, next: LaunchRuns): LaunchNotice[] {
  const notices: LaunchNotice[] = [];
  for (const [presetId, run] of Object.entries(next)) {
    const before = previous[presetId];
    // Nouveau lancement, ou lancement inchangé : rien à comparer.
    if (!before || before === run || before.startedAt !== run.startedAt) continue;

    if (before.inProgress && !run.inProgress) {
      const summary = summarizeItemRuns(Object.values(run.items));
      if (summary.failed > 0) {
        notices.push({
          type: "launch-failed",
          presetId,
          failed: summary.failed,
          launched: summary.total - summary.skipped,
        });
      }
      continue;
    }

    // Pendant la séquence, un échec est compté dans le bilan de fin : pas de doublon.
    if (run.inProgress) continue;
    for (const [itemId, itemRun] of Object.entries(run.items)) {
      const was = before.items[itemId];
      const wasRunningProcess = was?.status === "running" && was.processId !== undefined;
      if (wasRunningProcess && itemRun.status === "failed") {
        notices.push({ type: "command-failed", presetId, itemId, error: itemRun.error ?? "Command failed." });
      }
    }
  }
  return notices;
}
