import { demoPresets } from "@/domain/preset/fixtures";
import { serializePresetsFile } from "@/domain/preset/serialization";
import type { PresetStorage } from "@/domain/preset/storage";
import { createMemoryPresetStorage } from "@/platform/mock/memory-preset-storage";
import { isDesktop } from "@/platform/runtime";
import { tauriPresetStorage } from "@/platform/tauri/tauri-preset-storage";

/**
 * Stockage à utiliser : le vrai fichier dans l'app desktop, une copie en
 * mémoire des presets de démonstration dans un navigateur.
 */
export function createPresetStorage(): PresetStorage {
  return isDesktop() ? tauriPresetStorage : createMemoryPresetStorage(serializePresetsFile(demoPresets));
}
