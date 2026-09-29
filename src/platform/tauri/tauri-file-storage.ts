import { z } from "zod";
import type { FileStorage } from "@/domain/storage/file-storage";
import { invokeCommand } from "@/platform/tauri/invoke";

/** Fichiers de données connus de Rust (`models::DataFile`). */
export type DataFile = "presets" | "sessions";

const StoredFileSchema = z.object({ path: z.string(), content: z.string().nullable() });

/** Fichier de données sur disque, lu et écrit par Rust (`commands/storage.rs`). */
export function tauriFileStorage(file: DataFile): FileStorage {
  return {
    read: () => invokeCommand("load_data_file", { file }, StoredFileSchema),
    write: async (content) => {
      await invokeCommand("save_data_file", { file, content }, z.null());
    },
    backup: () => invokeCommand("backup_data_file", { file }, z.string()),
  };
}
