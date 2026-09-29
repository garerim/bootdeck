import type { PresetStorage } from "@/domain/preset/storage";

/**
 * Stockage en mémoire : aperçu dans un navigateur (`npm run dev:web`) et tests.
 * Rien n'est conservé après un rechargement.
 */
export function createMemoryPresetStorage(initialContent: string | null = null): PresetStorage {
  let content = initialContent;
  let backups = 0;
  return {
    read: async () => ({ path: "memory://presets.json", content }),
    write: async (next) => {
      content = next;
    },
    backup: async () => {
      if (content === null) throw new Error("There is no presets file to back up");
      content = null;
      backups += 1;
      return `memory://presets.invalid-${backups}.json`;
    },
  };
}
