import { demoPresets } from "@/domain/preset/fixtures";
import { serializePresetsFile } from "@/domain/preset/serialization";
import type { FileStorage } from "@/domain/storage/file-storage";
import { createMemoryFileStorage } from "@/platform/mock/memory-file-storage";
import { isDesktop } from "@/platform/runtime";
import { tauriFileStorage } from "@/platform/tauri/tauri-file-storage";

/**
 * Stockages à utiliser : les vrais fichiers dans l'app desktop, des copies en
 * mémoire dans un navigateur (presets de démonstration, historique vide).
 */
export function createPresetStorage(): FileStorage {
  return isDesktop() ? tauriFileStorage("presets") : createMemoryFileStorage(serializePresetsFile(demoPresets));
}

export function createSessionStorage(): FileStorage {
  return isDesktop() ? tauriFileStorage("sessions") : createMemoryFileStorage(null, "sessions");
}
