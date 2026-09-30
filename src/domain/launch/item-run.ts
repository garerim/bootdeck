import type { ProcessId } from "@/domain/launch/system-adapter";

/**
 * État d'un item pendant un lancement.
 *
 * L'état n'est jamais modifié directement : l'exécution émet des événements
 * (« démarré », « sortie », « terminé »…) et `applyItemRunEvent` calcule le
 * nouvel état. Une fonction pure : facile à tester, et un seul endroit où les
 * transitions sont définies.
 */

export type ItemRunStatus =
  | "pending" // en attente de son tour
  | "running" // en cours (une commande reste « running » tant que son processus vit)
  | "success"
  | "failed"
  | "skipped" // item désactivé
  | "stopped"; // commande arrêtée à la demande de l'utilisateur

export interface OutputLine {
  stream: "stdout" | "stderr";
  text: string;
}

export interface ItemRun {
  itemId: string;
  status: ItemRunStatus;
  error?: string;
  processId?: ProcessId;
  exitCode?: number | null;
  stopRequested: boolean;
  /** Dernières lignes de sortie d'une commande (bornées). */
  output: OutputLine[];
}

export type ItemRunEvent =
  | { type: "started" }
  | { type: "succeeded" }
  | { type: "failed"; error: string }
  | { type: "process-started"; processId: ProcessId }
  | { type: "output"; line: OutputLine }
  | { type: "stop-requested" }
  /** L'arrêt a échoué : la commande tourne toujours. */
  | { type: "stop-failed"; error: string }
  /** `missingProgram` : programme introuvable repéré par le système (voir SystemAdapter). */
  | { type: "exited"; code: number | null; missingProgram?: string };

/** Un serveur de dev bavard ne doit pas faire grossir la mémoire indéfiniment. */
export const MAX_OUTPUT_LINES = 500;

/**
 * Codes de sortie des shells quand la commande elle-même n'existe pas : 127 pour
 * `sh`, `bash` et `zsh`. 9009 pour `cmd.exe`, mais seulement si un script le
 * renvoie (`exit /b %errorlevel%`) : `cmd /c` sort avec 1, d'où `missingProgram`.
 */
const COMMAND_NOT_FOUND_EXIT_CODES: ReadonlySet<number> = new Set([127, 9009]);

const NOT_FOUND_HINT = "Check its spelling, and that the program is installed and in your PATH.";

function describeExit(code: number | null, missingProgram: string | undefined): string {
  if (code === null) return "Command was terminated by the system.";
  if (missingProgram !== undefined) return `Command not found: ${missingProgram}. ${NOT_FOUND_HINT}`;
  if (COMMAND_NOT_FOUND_EXIT_CODES.has(code)) return `Command not found (exit code ${code}). ${NOT_FOUND_HINT}`;
  return `Command exited with code ${code}.`;
}

export function createItemRun(itemId: string, status: "pending" | "skipped" = "pending"): ItemRun {
  return { itemId, status, stopRequested: false, output: [] };
}

export function applyItemRunEvent(run: ItemRun, event: ItemRunEvent): ItemRun {
  switch (event.type) {
    case "started":
      return { ...createItemRun(run.itemId), status: "running" };
    case "succeeded":
      return { ...run, status: "success" };
    case "failed":
      return { ...run, status: "failed", error: event.error };
    case "process-started":
      // L'événement « exited » peut arriver AVANT l'identifiant (commande très courte) :
      // on n'écrase donc pas le statut, on enregistre seulement l'identifiant.
      return { ...run, processId: event.processId };
    case "output":
      return { ...run, output: [...run.output, event.line].slice(-MAX_OUTPUT_LINES) };
    case "stop-requested":
      return { ...run, stopRequested: true, error: undefined };
    case "stop-failed":
      return { ...run, stopRequested: false, error: event.error };
    case "exited":
      if (run.stopRequested) return { ...run, status: "stopped", exitCode: event.code };
      if (event.code === 0) return { ...run, status: "success", exitCode: 0 };
      return {
        ...run,
        status: "failed",
        exitCode: event.code,
        error: describeExit(event.code, event.missingProgram),
      };
  }
}

export type RunSummary = Record<ItemRunStatus, number> & { total: number };

/** Accepte tout ce qui a un statut : états en cours (ItemRun) ou items de session. */
export function summarizeItemRuns(runs: readonly Pick<ItemRun, "status">[]): RunSummary {
  const summary: RunSummary = {
    total: runs.length,
    pending: 0,
    running: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    stopped: 0,
  };
  for (const run of runs) summary[run.status] += 1;
  return summary;
}
