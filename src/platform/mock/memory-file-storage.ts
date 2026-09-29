import type { FileStorage } from "@/domain/storage/file-storage";

/**
 * Stockage en mémoire : aperçu dans un navigateur (`npm run dev:web`) et tests.
 * Rien n'est conservé après un rechargement.
 */
export function createMemoryFileStorage(initialContent: string | null = null, name = "presets"): FileStorage {
  let content = initialContent;
  let backups = 0;
  return {
    read: async () => ({ path: `memory://${name}.json`, content }),
    write: async (next) => {
      content = next;
    },
    backup: async () => {
      if (content === null) throw new Error(`There is no ${name} file to back up`);
      content = null;
      backups += 1;
      return `memory://${name}.invalid-${backups}.json`;
    },
  };
}
