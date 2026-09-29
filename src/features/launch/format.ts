import type { ItemRunStatus, RunSummary } from "@/domain/launch/item-run";
import type { PresetItemType } from "@/domain/preset/schema";

/** `Launching… 3 of 7` pendant la séquence, puis `6/7 launched · 1 failed`. */
export function describeRunSummary(summary: RunSummary, inProgress: boolean): string {
  const toLaunch = summary.total - summary.skipped;
  if (inProgress) {
    return `Launching… ${toLaunch - summary.pending} of ${toLaunch}`;
  }
  // Une commande encore active ou arrêtée par l'utilisateur a bien été lancée.
  const launched = summary.success + summary.running + summary.stopped;
  const parts = [`${launched}/${toLaunch} launched`];
  if (summary.failed > 0) parts.push(`${summary.failed} failed`);
  if (summary.running > 0) parts.push(`${summary.running} running`);
  if (summary.skipped > 0) parts.push(`${summary.skipped} skipped`);
  return parts.join(" · ");
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
