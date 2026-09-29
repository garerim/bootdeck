import type { ProcessEvent, ProcessId, SystemAdapter } from "@/domain/launch/system-adapter";

/**
 * Système simulé, pour l'aperçu dans un navigateur et les tests : rien n'est
 * réellement ouvert ni exécuté. Les délais imitent un vrai lancement.
 *
 * Commandes simulées : elles restent actives (comme un serveur de dev) jusqu'à
 * `stopProcess`, sauf si elles contiennent « fail », qui se termine avec le code 1.
 */
export function createMockSystemAdapter({ delayMs = 300 }: { delayMs?: number } = {}): SystemAdapter {
  let nextId = 1;
  const stops = new Map<ProcessId, () => void>();
  const wait = () => new Promise<void>((resolve) => setTimeout(resolve, delayMs));

  return {
    openUrl: wait,
    openFolder: wait,
    launchApplication: wait,

    executeCommand: async (request, onEvent) => {
      await wait();
      const id = nextId++;
      const timers: ReturnType<typeof setTimeout>[] = [];
      const later = (ms: number, event: ProcessEvent) => timers.push(setTimeout(() => onEvent(event), ms));
      const finish = (code: number) => {
        timers.forEach(clearTimeout);
        if (stops.delete(id)) onEvent({ type: "exited", code });
      };
      stops.set(id, () => finish(1));

      later(100, { type: "stdout", line: `> ${request.command}` });
      later(250, { type: "stdout", line: "Browser preview: nothing is actually executed." });
      if (request.command.includes("fail")) {
        later(500, { type: "stderr", line: "Error: simulated failure" });
        timers.push(setTimeout(() => finish(1), 600));
      }
      return id;
    },

    stopProcess: async (processId) => {
      stops.get(processId)?.();
    },
  };
}
