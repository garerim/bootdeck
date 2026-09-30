import { toast } from "sonner";
import type { StoreApi } from "zustand";
import { detectLaunchNotices, type LaunchNotice } from "@/domain/launch/notices";
import type { LaunchRun, LaunchState } from "@/stores/launch-store";
import { useNavigationStore } from "@/stores/navigation-store";
import { presetsStore } from "@/stores/presets-store";

/** Une commande qui plante mérite plus que les 4 s par défaut : l'utilisateur regardait ailleurs. */
const FAILURE_TOAST_DURATION_MS = 10_000;

/**
 * Signale par une notification les échecs de lancement que l'écran affiché ne
 * montre pas (ex. le serveur de dev s'arrête pendant qu'on édite un autre preset).
 * Renvoie la fonction de désabonnement.
 */
export function notifyLaunchProblems(launch: StoreApi<Pick<LaunchState, "runs">>): () => void {
  return launch.subscribe((state, previous) => {
    if (state.runs === previous.runs) return;
    for (const notice of detectLaunchNotices(previous.runs, state.runs)) {
      const run = state.runs[notice.presetId];
      if (run && !isOnScreen(notice.presetId)) show(notice, run);
    }
  });
}

/** La page du preset est affichée : son statut y est déjà visible. */
function isOnScreen(presetId: string): boolean {
  const { route } = useNavigationStore.getState();
  return route.name === "preset-detail" && route.presetId === presetId;
}

function show(notice: LaunchNotice, run: LaunchRun): void {
  // Noms actuels du preset ; à défaut (preset supprimé), ceux du lancement.
  const preset = presetsStore.getState().presets.find((candidate) => candidate.id === notice.presetId);
  const presetName = preset?.name ?? run.session?.presetName ?? "A preset";
  const view = {
    label: "View",
    onClick: () => useNavigationStore.getState().navigate({ name: "preset-detail", presetId: notice.presetId }),
  };

  switch (notice.type) {
    case "launch-failed":
      toast.error(`${presetName}: ${notice.failed} of ${notice.launched} items failed`, {
        action: view,
        duration: FAILURE_TOAST_DURATION_MS,
      });
      return;
    case "command-failed": {
      const itemName =
        preset?.items.find((item) => item.id === notice.itemId)?.name ??
        run.session?.items.find((item) => item.id === notice.itemId)?.name ??
        "A command";
      toast.error(`${itemName} stopped`, {
        description: `${presetName} · ${notice.error}`,
        action: view,
        duration: FAILURE_TOAST_DURATION_MS,
      });
      return;
    }
  }
}
