import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { duplicatePreset } from "@/domain/preset/operations";
import type { Preset } from "@/domain/preset/schema";
import { loadPresets, savePresets, type PresetsLoadError } from "@/domain/preset/storage";
import type { FileStorage } from "@/domain/storage/file-storage";
import { errorMessage } from "@/lib/errors";
import { createPresetStorage } from "@/platform/data-storage";

export type LoadState =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; error: PresetsLoadError };

export interface PresetsState {
  presets: Preset[];
  load: LoadState;
  /** Emplacement du fichier de données (affiché dans les réglages). */
  filePath: string | null;
  /** Dernier échec d'enregistrement, effacé par la prochaine sauvegarde réussie. */
  saveError: string | null;
  /** Information ponctuelle à afficher (ex. copie de sauvegarde créée). */
  notice: string | null;

  initialize: () => Promise<void>;
  /** Crée le preset s'il n'existe pas, sinon le remplace. */
  save: (preset: Preset) => void;
  remove: (id: string) => void;
  /** Insère la copie juste après l'original et la renvoie. */
  duplicate: (id: string) => Preset | undefined;
  retrySave: () => Promise<void>;
  /** Met de côté un fichier illisible et repart d'une liste vide. */
  backupAndReset: () => Promise<{ ok: true } | { ok: false; message: string }>;
  dismissNotice: () => void;
  /** Attend la fin des écritures en cours. */
  flush: () => Promise<void>;
}

/**
 * Presets de l'application et leur persistance.
 *
 * Fabrique plutôt que singleton : l'app lui passe le vrai stockage, les tests
 * un stockage en mémoire.
 */
export function createPresetsStore(storage: FileStorage) {
  // Écritures enchaînées : chacune attend la précédente, donc la dernière
  // modification demandée est toujours la dernière écrite sur le disque.
  let writes: Promise<void> = Promise.resolve();

  return createStore<PresetsState>()((set, get) => {
    function persist(): Promise<void> {
      const snapshot = get().presets;
      writes = writes.then(async () => {
        try {
          await savePresets(storage, snapshot);
          set({ saveError: null });
        } catch (error) {
          set({ saveError: errorMessage(error) });
        }
      });
      return writes;
    }

    /**
     * Applique une modification puis la sauvegarde, uniquement si les presets
     * ont été chargés : après un échec de lecture, écrire écraserait le fichier
     * que l'on n'a pas su lire.
     */
    function update(change: (presets: Preset[]) => Preset[]): boolean {
      if (get().load.status !== "ready") return false;
      set(({ presets }) => ({ presets: change(presets) }));
      void persist();
      return true;
    }

    return {
      presets: [],
      load: { status: "loading" },
      filePath: null,
      saveError: null,
      notice: null,

      initialize: async () => {
        set({ load: { status: "loading" } });
        const result = await loadPresets(storage);
        set(
          result.ok
            ? { presets: result.presets, filePath: result.path, load: { status: "ready" } }
            : { presets: [], filePath: result.path, load: { status: "error", error: result.error } },
        );
      },

      save: (preset) => {
        update((presets) =>
          presets.some((existing) => existing.id === preset.id)
            ? presets.map((existing) => (existing.id === preset.id ? preset : existing))
            : [...presets, preset],
        );
      },

      remove: (id) => {
        update((presets) => presets.filter((preset) => preset.id !== id));
      },

      duplicate: (id) => {
        const original = get().presets.find((preset) => preset.id === id);
        if (!original) return undefined;
        const copy = duplicatePreset(original, { now: new Date(), newId: () => crypto.randomUUID() });
        const applied = update((presets) => {
          const index = presets.findIndex((preset) => preset.id === id);
          return [...presets.slice(0, index + 1), copy, ...presets.slice(index + 1)];
        });
        return applied ? copy : undefined;
      },

      retrySave: () => (get().load.status === "ready" ? persist() : Promise.resolve()),

      backupAndReset: async () => {
        try {
          const backupPath = await storage.backup();
          set({
            presets: [],
            load: { status: "ready" },
            notice: `Your previous presets file was kept as ${backupPath}`,
          });
          return { ok: true };
        } catch (error) {
          return { ok: false, message: errorMessage(error) };
        }
      },

      dismissNotice: () => set({ notice: null }),

      flush: () => writes,
    };
  });
}

/** Instance utilisée par l'application. */
export const presetsStore = createPresetsStore(createPresetStorage());

export function usePresetsStore<T>(selector: (state: PresetsState) => T): T {
  return useStore(presetsStore, selector);
}
