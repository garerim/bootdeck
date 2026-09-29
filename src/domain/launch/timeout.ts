import type { SystemAdapter } from "@/domain/launch/system-adapter";

/** Délai maximal d'un appel au système (ouvrir, démarrer : jamais attendre la fin d'une commande). */
export const SYSTEM_CALL_TIMEOUT_MS = 15_000;

export function withTimeout<T>(operation: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`No response from the system after ${formatSeconds(ms)}.`));
    }, ms);
    operation.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Décore un `SystemAdapter` : chaque appel échoue s'il ne répond pas à temps.
 * Même interface en entrée et en sortie : le moteur ne sait pas qu'il est décoré.
 */
export function withTimeouts(system: SystemAdapter, ms: number = SYSTEM_CALL_TIMEOUT_MS): SystemAdapter {
  return {
    openUrl: (url) => withTimeout(system.openUrl(url), ms),
    openFolder: (path) => withTimeout(system.openFolder(path), ms),
    launchApplication: (request) => withTimeout(system.launchApplication(request), ms),
    // Seul le démarrage est borné : la commande peut ensuite tourner aussi longtemps qu'il faut.
    executeCommand: (request, onEvent) => withTimeout(system.executeCommand(request, onEvent), ms),
    stopProcess: (processId) => withTimeout(system.stopProcess(processId), ms),
  };
}

function formatSeconds(ms: number): string {
  const seconds = ms / 1000;
  return `${Number.isInteger(seconds) ? seconds : seconds.toFixed(1)} s`;
}
