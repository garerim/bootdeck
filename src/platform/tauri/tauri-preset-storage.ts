import { z } from "zod";
import type { PresetStorage } from "@/domain/preset/storage";
import { invokeCommand } from "@/platform/tauri/invoke";

const StoredFileSchema = z.object({ path: z.string(), content: z.string().nullable() });

/** Fichier des presets sur disque, lu et écrit par Rust (`commands/storage.rs`). */
export const tauriPresetStorage: PresetStorage = {
  read: () => invokeCommand("load_presets", undefined, StoredFileSchema),
  write: async (content) => {
    await invokeCommand("save_presets", { content }, z.null());
  },
  backup: () => invokeCommand("backup_presets_file", undefined, z.string()),
};
