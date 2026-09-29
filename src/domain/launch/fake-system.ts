import type { ProcessEvent, ProcessId, SystemAdapter } from "@/domain/launch/system-adapter";

/**
 * Faux système pour les tests : enregistre chaque appel et laisse le test
 * piloter les processus (émettre de la sortie, les terminer).
 */
export function createFakeSystem(overrides: Partial<SystemAdapter> = {}) {
  const calls: string[] = [];
  const listeners = new Map<ProcessId, (event: ProcessEvent) => void>();
  let nextId = 1;

  const system: SystemAdapter = {
    openUrl: async (url) => {
      calls.push(`url ${url}`);
    },
    openFolder: async (path) => {
      calls.push(`folder ${path}`);
    },
    launchApplication: async (request) => {
      calls.push(`app ${[request.path, ...request.args].join(" ")} in ${request.workingDirectory ?? "~"}`);
    },
    executeCommand: async (request, onEvent) => {
      calls.push(`command ${request.command} in ${request.workingDirectory ?? "~"}`);
      const id = nextId++;
      listeners.set(id, onEvent);
      return id;
    },
    stopProcess: async (processId) => {
      calls.push(`stop ${processId}`);
      listeners.get(processId)?.({ type: "exited", code: 1 });
    },
    ...overrides,
  };

  return {
    system,
    calls,
    /** Simule un événement du processus `processId`. */
    emit: (processId: ProcessId, event: ProcessEvent) => listeners.get(processId)?.(event),
  };
}
