import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";
import { sessionFromRun, upsertSession, type Session } from "@/domain/session/session";
import { parseSessionsFile, serializeSessionsFile } from "@/domain/session/sessions-file";
import type { FileStorage } from "@/domain/storage/file-storage";
import { errorMessage } from "@/lib/errors";
import { createSessionStorage } from "@/platform/data-storage";
import type { LaunchState } from "@/stores/launch-store";
import { launchStore } from "@/stores/launch-store";

/**
 * Historique des lancements (sessions), enregistré dans `sessions.json`.
 *
 * - `ready` : lu et enregistré normalement ;
 * - `read-only` : fichier d'une version plus récente, ou disque inaccessible —
 *   on n'écrit pas, pour ne rien écraser.
 */
export type SessionsMode = "loading" | "ready" | "read-only";

export interface SessionsState {
  sessions: Session[];
  mode: SessionsMode;
  notice: string | null;
  initialize: () => Promise<void>;
  /** Ajoute ou met à jour une session, puis l'enregistre. */
  record: (session: Session) => void;
  /** Vide l'historique, en gardant les sessions pour lesquelles `keep` renvoie vrai. */
  clear: (keep?: (session: Session) => boolean) => void;
  dismissNotice: () => void;
  flush: () => Promise<void>;
}

export function createSessionsStore(storage: FileStorage) {
  let writes: Promise<void> = Promise.resolve();

  return createStore<SessionsState>()((set, get) => {
    function persist() {
      if (get().mode !== "ready") return;
      const content = serializeSessionsFile(get().sessions);
      writes = writes
        .then(() => storage.write(content))
        // Historique : un échec d'écriture est signalé, mais ne bloque rien.
        .catch((error: unknown) => set({ notice: `Your launch history couldn’t be saved: ${errorMessage(error)}` }));
    }

    return {
      sessions: [],
      mode: "loading",
      notice: null,

      initialize: async () => {
        let file: Awaited<ReturnType<FileStorage["read"]>>;
        try {
          file = await storage.read();
        } catch (error) {
          set({ mode: "read-only", notice: `Your launch history couldn’t be read: ${errorMessage(error)}` });
          return;
        }
        if (file.content === null) {
          set({ mode: "ready" });
          return;
        }

        const parsed = parseSessionsFile(file.content);
        if (parsed.ok) {
          set({
            mode: "ready",
            sessions: parsed.sessions,
            notice:
              parsed.ignored > 0
                ? `${parsed.ignored} unreadable ${parsed.ignored === 1 ? "session was" : "sessions were"} left out of your launch history.`
                : null,
          });
          return;
        }
        if (parsed.error.kind === "unsupported-version") {
          set({
            mode: "read-only",
            notice: "Your launch history was written by a newer version of Bootdeck. New launches won’t be recorded.",
          });
          return;
        }
        // Historique illisible : on le met de côté (jamais supprimé) et on repart de zéro,
        // sans demander : contrairement aux presets, ce n'est que de l'historique.
        try {
          const backupPath = await storage.backup();
          set({
            mode: "ready",
            sessions: [],
            notice: `Your launch history couldn’t be read and was reset. The old file was kept as ${backupPath}`,
          });
        } catch (error) {
          set({ mode: "read-only", notice: `Your launch history couldn’t be read: ${errorMessage(error)}` });
        }
      },

      record: (session) => {
        set(({ sessions }) => ({ sessions: upsertSession(sessions, session) }));
        persist();
      },

      clear: (keep = () => false) => {
        set(({ sessions }) => ({ sessions: sessions.filter(keep) }));
        persist();
      },

      dismissNotice: () => set({ notice: null }),

      flush: () => writes,
    };
  });
}

/**
 * Enregistre chaque lancement complet comme session, au fil de ses changements.
 *
 * Le moteur prévient à chaque ligne de sortie d'une commande ; on ne réécrit
 * pourtant le fichier que si l'instantané de la session a réellement changé
 * (un statut, une erreur, la fin de la séquence).
 */
export function recordSessions(
  launch: StoreApi<Pick<LaunchState, "runs">>,
  sessions: StoreApi<SessionsState>,
): () => void {
  const lastRecorded = new Map<string, string>();
  return launch.subscribe((state, previous) => {
    if (state.runs === previous.runs) return;
    for (const run of Object.values(state.runs)) {
      const session = sessionFromRun(run);
      if (!session) continue;
      const snapshot = JSON.stringify(session);
      if (lastRecorded.get(session.id) === snapshot) continue;
      lastRecorded.set(session.id, snapshot);
      sessions.getState().record(session);
    }
  });
}

/** Instance utilisée par l'application. */
export const sessionsStore = createSessionsStore(createSessionStorage());

export function useSessionsStore<T>(selector: (state: SessionsState) => T): T {
  return useStore(sessionsStore, selector);
}

/** Identifiant de la session du lancement en cours de ce preset, s'il y en a une. */
export function useLiveSessionId(presetId: string): string | undefined {
  return useStore(launchStore, (state) => state.runs[presetId]?.session?.id);
}
