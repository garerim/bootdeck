import type { Preset } from "@/domain/preset/schema";
import {
  parsePresetsFile,
  serializePresetsFile,
  type PresetsFileError,
} from "@/domain/preset/serialization";
import type { FileStorage } from "@/domain/storage/file-storage";
import { errorMessage } from "@/lib/errors";

export type PresetsLoadError = PresetsFileError | { kind: "read-failed"; message: string };

export type LoadPresetsResult =
  | { ok: true; path: string; presets: Preset[] }
  | { ok: false; path: string | null; error: PresetsLoadError };

export async function loadPresets(storage: FileStorage): Promise<LoadPresetsResult> {
  let file: Awaited<ReturnType<FileStorage["read"]>>;
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

export function savePresets(storage: FileStorage, presets: readonly Preset[]): Promise<void> {
  return storage.write(serializePresetsFile(presets));
}
