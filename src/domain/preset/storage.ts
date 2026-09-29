import type { Preset } from "@/domain/preset/schema";
import {
  parsePresetsFile,
  serializePresetsFile,
  type PresetsFileError,
} from "@/domain/preset/serialization";
import { errorMessage } from "@/lib/errors";

/**
 * Port de stockage : ce dont le domaine a besoin, sans savoir comment c'est fait.
 * Implémentations : Tauri (fichier sur disque, via Rust) et mémoire (navigateur, tests).
 */
export interface PresetStorage {
  /** Lit le fichier. `content` vaut `null` s'il n'existe pas encore. */
  read(): Promise<{ path: string; content: string | null }>;
  /** Remplace le contenu du fichier. */
  write(content: string): Promise<void>;
  /** Met le fichier actuel de côté et renvoie le chemin de la copie. */
  backup(): Promise<string>;
}

export type PresetsLoadError = PresetsFileError | { kind: "read-failed"; message: string };

export type LoadPresetsResult =
  | { ok: true; path: string; presets: Preset[] }
  | { ok: false; path: string | null; error: PresetsLoadError };

export async function loadPresets(storage: PresetStorage): Promise<LoadPresetsResult> {
  let file: Awaited<ReturnType<PresetStorage["read"]>>;
  try {
    file = await storage.read();
  } catch (error) {
    return { ok: false, path: null, error: { kind: "read-failed", message: errorMessage(error) } };
  }

  // Premier lancement : pas encore de fichier, ce n'est pas une erreur.
  if (file.content === null) return { ok: true, path: file.path, presets: [] };

  const parsed = parsePresetsFile(file.content);
  return parsed.ok
    ? { ok: true, path: file.path, presets: parsed.file.presets }
    : { ok: false, path: file.path, error: parsed.error };
}

export function savePresets(storage: PresetStorage, presets: readonly Preset[]): Promise<void> {
  return storage.write(serializePresetsFile(presets));
}
