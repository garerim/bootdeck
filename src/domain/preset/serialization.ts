import { z } from "zod";
import {
  CURRENT_SCHEMA_VERSION,
  PresetsFileSchema,
  type Preset,
  type PresetsFile,
} from "@/domain/preset/schema";

/**
 * Conversion entre la liste des presets et le contenu du fichier stocké sur disque.
 *
 * La lecture ne lève jamais d'exception : elle renvoie un résultat explicite.
 * Un fichier illisible est une situation attendue (édition manuelle, disque
 * plein pendant une écriture, version plus récente de l'app…), pas un bug.
 */

export interface ValidationIssue {
  /** Emplacement lisible, ex. `presets[0].items[2].config.url`. */
  path: string;
  message: string;
}

export type PresetsFileError =
  | { kind: "invalid-json"; message: string }
  | { kind: "unsupported-version"; found: number; expected: number }
  | { kind: "invalid-data"; issues: ValidationIssue[] };

export type ParsePresetsFileResult =
  | { ok: true; file: PresetsFile }
  | { ok: false; error: PresetsFileError };

/** Lit uniquement le numéro de version, sans rien présumer du reste. */
const VersionProbeSchema = z.object({ schemaVersion: z.number().int().positive() });

export function parsePresetsFile(raw: string): ParsePresetsFileResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: { kind: "invalid-json", message } };
  }

  // Vérifier la version AVANT le contenu : un fichier écrit par une version plus
  // récente de l'app est probablement valide pour elle. Il ne faut surtout pas
  // le signaler comme « corrompu », ni l'écraser.
  const probe = VersionProbeSchema.safeParse(data);
  if (probe.success && probe.data.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    return {
      ok: false,
      error: {
        kind: "unsupported-version",
        found: probe.data.schemaVersion,
        expected: CURRENT_SCHEMA_VERSION,
      },
    };
  }

  const parsed = PresetsFileSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: { kind: "invalid-data", issues: toValidationIssues(parsed.error) } };
  }
  return { ok: true, file: parsed.data };
}

/**
 * Produit le contenu du fichier (JSON indenté, lisible et facile à comparer).
 * Revalide avant d'écrire : on ne doit jamais persister une donnée invalide.
 * Si c'est le cas, c'est un bug de l'application, d'où l'exception.
 */
export function serializePresetsFile(presets: readonly Preset[]): string {
  const file = PresetsFileSchema.parse({ schemaVersion: CURRENT_SCHEMA_VERSION, presets });
  return `${JSON.stringify(file, null, 2)}\n`;
}

function toValidationIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({ path: formatPath(issue.path), message: issue.message }));
}

function formatPath(path: readonly PropertyKey[]): string {
  return path.reduce<string>((acc, key) => {
    if (typeof key === "number") return `${acc}[${key}]`;
    return acc ? `${acc}.${String(key)}` : String(key);
  }, "");
}
