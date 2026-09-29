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
  /** `migratedFrom` : version d'origine si le fichier a été mis à jour en mémoire. */
  | { ok: true; file: PresetsFile; migratedFrom?: number }
  | { ok: false; error: PresetsFileError };

/** Lit uniquement le numéro de version, sans rien présumer du reste. */
const VersionProbeSchema = z.object({ schemaVersion: z.number().int().positive() });

type RawRecord = Record<string, unknown>;

/**
 * Migrations successives : `MIGRATIONS[n]` transforme un fichier en version n
 * en fichier en version n + 1. Elles travaillent sur des données NON validées
 * (le schéma de l'ancienne version n'existe plus) : elles ne touchent qu'à ce
 * qu'elles reconnaissent, et la validation complète a lieu après, avec le schéma actuel.
 */
const MIGRATIONS: Record<number, (file: RawRecord) => RawRecord> = {
  1: migrateV1ToV2,
};

/**
 * v1 → v2 : ajoute `variables` et préserve le SENS des champs. En v1, une
 * accolade était toujours littérale ; en v2, `{nom}` désigne une variable. On
 * double donc les accolades existantes (`{a}` → `{{a}}`, qui s'affiche `{a}`).
 */
function migrateV1ToV2(file: RawRecord): RawRecord {
  const escapeBraces = (value: unknown): unknown =>
    typeof value === "string"
      ? value.replace(/\{/g, "{{").replace(/\}/g, "}}")
      : Array.isArray(value)
        ? value.map(escapeBraces)
        : value;

  const migrateItem = (item: unknown) =>
    isRecord(item) && isRecord(item.config)
      ? { ...item, config: Object.fromEntries(Object.entries(item.config).map(([key, value]) => [key, escapeBraces(value)])) }
      : item;

  const migratePreset = (preset: unknown) =>
    isRecord(preset)
      ? { ...preset, variables: [], items: Array.isArray(preset.items) ? preset.items.map(migrateItem) : preset.items }
      : preset;

  return {
    ...file,
    schemaVersion: 2,
    presets: Array.isArray(file.presets) ? file.presets.map(migratePreset) : file.presets,
  };
}

function isRecord(value: unknown): value is RawRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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
  let migratedFrom: number | undefined;
  if (probe.success && probe.data.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    const found = probe.data.schemaVersion;
    if (found > CURRENT_SCHEMA_VERSION || !isRecord(data)) {
      return { ok: false, error: { kind: "unsupported-version", found, expected: CURRENT_SCHEMA_VERSION } };
    }
    // Fichier plus ancien : on applique les migrations une à une, jusqu'à la version actuelle.
    let migrated: RawRecord = data;
    for (let version = found; version < CURRENT_SCHEMA_VERSION; version++) {
      const migrate = MIGRATIONS[version];
      if (!migrate) {
        return { ok: false, error: { kind: "unsupported-version", found, expected: CURRENT_SCHEMA_VERSION } };
      }
      migrated = migrate(migrated);
    }
    data = migrated;
    migratedFrom = found;
  }

  const parsed = PresetsFileSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: { kind: "invalid-data", issues: toValidationIssues(parsed.error) } };
  }
  return migratedFrom === undefined ? { ok: true, file: parsed.data } : { ok: true, file: parsed.data, migratedFrom };
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
