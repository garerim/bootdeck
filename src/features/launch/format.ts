import type { ItemRunStatus, RunSummary } from "@/domain/launch/item-run";
import type { PresetItemType } from "@/domain/preset/schema";

/** `Launching… 3 of 7` pendant la séquence, puis `6/7 launched in 1.2 s · 1 failed`. */
export function describeRunSummary(summary: RunSummary, inProgress: boolean, durationMs?: number): string {
  const toLaunch = summary.total - summary.skipped;
  if (inProgress) {
    return `Launching… ${toLaunch - summary.pending} of ${toLaunch}`;
  }
  // Une commande encore active ou arrêtée par l'utilisateur a bien été lancée.
  const launched = summary.success + summary.running + summary.stopped;
  const duration = durationMs === undefined ? "" : ` in ${formatDuration(durationMs)}`;
  const parts = [`${launched}/${toLaunch} launched${duration}`];
  if (summary.failed > 0) parts.push(`${summary.failed} failed`);
  if (summary.running > 0) parts.push(`${summary.running} running`);
  if (summary.skipped > 0) parts.push(`${summary.skipped} skipped`);
  return parts.join(" · ");
}

/** `42 ms` sous la seconde (un lancement n'attend pas la fin des commandes), sinon `1.2 s`. */
export function formatDuration(ms: number): string {
  return ms < 1000 ? `${Math.max(1, Math.round(ms))} ms` : `${(ms / 1000).toFixed(1)} s`;
}

/** Libellé d'un statut, adapté au type d'item (« Opened », « Launched », « Done »…). */
export function statusLabel(status: ItemRunStatus, type: PresetItemType): string {
  switch (status) {
    case "pending":
      return "Waiting";
    case "running":
      return type === "command" ? "Running" : "Opening…";
    case "success":
      return type === "command" ? "Done" : type === "application" ? "Launched" : "Opened";
    case "failed":
      return "Failed";
    case "skipped":
      return "Skipped";
    case "stopped":
      return "Stopped";
  }
}
