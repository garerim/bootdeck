import { z } from "zod";
import type { ItemResolver } from "@/domain/launch/pipeline";
import { isAbsoluteOrHomePath } from "@/domain/preset/fields";
import { mapTemplateFields, templateFields } from "@/domain/preset/item-fields";
import type { PresetItem } from "@/domain/preset/schema";
import {
  VARIABLE_NAME_PATTERN,
  formatVariableList,
  renderTemplate,
  templateVariables,
} from "@/domain/variables/template";

/**
 * Variables d'un preset : déclarées dans le preset, demandées au lancement,
 * puis remplacées dans les champs des items avant l'exécution.
 */

// ─── Types de variables ────────────────────────────────────────────────────────

interface VariableKind {
  label: string;
  hint: string;
  /** Message d'erreur, ou `null` si la valeur est acceptable. */
  validate: (value: string) => string | null;
}

/** Aucun caractère qui aurait un sens pour un shell (&, |, ;, guillemets…). */
const SAFE_TEXT = /^[A-Za-z0-9._-]+$/;
const SHELL_SPECIAL_CHARACTERS = /[&|;<>^"'`$%!\u0000-\u001f\u007f]/;

/**
 * Registre des types de variables. Ajouter un type = ajouter une entrée ici.
 * Les valeurs sont volontairement restreintes : elles seront insérées dans des
 * commandes shell, où un `&` ou un `;` pourrait enchaîner une seconde commande.
 */
export const VARIABLE_KINDS = {
  text: {
    label: "Text",
    hint: "Letters, digits, dots, dashes and underscores.",
    validate: (value) =>
      SAFE_TEXT.test(value) ? null : "Use only letters, digits, dots, dashes and underscores.",
  },
  path: {
    label: "Path",
    hint: "An absolute path, or one starting with ~.",
    validate: (value) => {
      if (!isAbsoluteOrHomePath(value)) return "Use an absolute path (C:\\…, /…) or a path starting with ~.";
      if (SHELL_SPECIAL_CHARACTERS.test(value)) return "A path can’t contain & | ; < > ^ \" ' ` $ % or !.";
      return null;
    },
  },
  port: {
    label: "Port",
    hint: "A number between 1 and 65535.",
    validate: (value) => {
      const port = Number(value);
      return /^\d{1,5}$/.test(value) && port >= 1 && port <= 65535 ? null : "Use a number between 1 and 65535.";
    },
  },
} satisfies Record<string, VariableKind>;

export type VariableKindId = keyof typeof VARIABLE_KINDS;

export const VARIABLE_KIND_IDS = Object.keys(VARIABLE_KINDS) as VariableKindId[];

// ─── Définition ────────────────────────────────────────────────────────────────

export const MAX_VARIABLES_PER_PRESET = 20;

export const VariableDefinitionSchema = z.object({
  /** Nom utilisé dans les champs : `project` pour `{project}`. */
  key: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(40, "Name must be at most 40 characters")
    .regex(VARIABLE_NAME_PATTERN, "Use lowercase letters, digits and _ (e.g. project_path)"),
  /** Libellé affiché au lancement ; à défaut, dérivé du nom. */
  label: z.string().trim().max(40, "Label must be at most 40 characters").optional(),
  kind: z.enum(["text", "path", "port"] satisfies [VariableKindId, ...VariableKindId[]]),
  /** Valeur proposée. Peut utiliser les variables déclarées AVANT : `~/Projects/{project}`. */
  defaultValue: z.string().trim().max(4096, "Value is too long").optional(),
});

export type VariableDefinition = z.infer<typeof VariableDefinitionSchema>;

/** `project_path` → `Project path` */
export function variableLabel(definition: VariableDefinition): string {
  if (definition.label) return definition.label;
  const words = definition.key.replace(/_+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Problème d'une valeur par défaut, vérifiable avant tout lancement : elle ne
 * peut utiliser que des variables déclarées avant elle, et si elle n'en utilise
 * aucune, elle doit déjà respecter son type.
 */
export function defaultValueProblem(
  definition: VariableDefinition,
  earlierKeys: ReadonlySet<string>,
): string | null {
  const value = definition.defaultValue;
  if (!value) return null;
  const used = templateVariables(value);
  const undeclared = used.filter((name) => !earlierKeys.has(name));
  if (undeclared.length > 0) return `${formatVariableList(undeclared)} must be declared above this variable`;
  if (used.length > 0) return null; // validée au lancement, une fois les valeurs connues
  return VARIABLE_KINDS[definition.kind].validate(value);
}

// ─── Valeurs au lancement ──────────────────────────────────────────────────────

export type ResolveValuesResult =
  | { ok: true; values: Record<string, string> }
  | { ok: false; errors: Record<string, string> };

/**
 * Calcule la valeur finale de chaque variable, dans l'ordre de déclaration :
 * une valeur peut utiliser les variables déclarées avant elle
 * (`project_path` = `~/Projects/{project}`). Pas de cycle possible.
 */
export function resolveValues(
  definitions: readonly VariableDefinition[],
  inputs: Readonly<Record<string, string | undefined>>,
): ResolveValuesResult {
  const values: Record<string, string> = {};
  const errors: Record<string, string> = {};

  for (const definition of definitions) {
    const raw = (inputs[definition.key] ?? definition.defaultValue ?? "").trim();
    if (!raw) {
      errors[definition.key] = "A value is required.";
      continue;
    }
    const rendered = renderTemplate(raw, values);
    if (!rendered.ok) {
      errors[definition.key] = `Uses ${formatVariableList(rendered.missing)}, which must be declared above and valid.`;
      continue;
    }
    const problem = VARIABLE_KINDS[definition.kind].validate(rendered.value);
    if (problem) {
      errors[definition.key] = problem;
      continue;
    }
    values[definition.key] = rendered.value;
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, values };
}

// ─── Utilisation dans les items ────────────────────────────────────────────────

/** Variables utilisées par ces items, sans doublon. */
export function variablesUsedBy(items: readonly PresetItem[]): string[] {
  const names = items.flatMap((item) => templateFields(item).flatMap((field) => templateVariables(field.value)));
  return [...new Set(names)];
}

/**
 * Résolveur branché sur le moteur de lancement : remplace les variables dans
 * tous les champs de l'item. Toujours utilisé, même sans variable, pour que les
 * échappements `{{` et `}}` soient rendus de la même façon partout.
 */
export function createVariableResolver(values: Readonly<Record<string, string>>): ItemResolver {
  return (item) => {
    const missing = new Set<string>();
    const resolved = mapTemplateFields(item, (template) => {
      const rendered = renderTemplate(template, values);
      if (rendered.ok) return rendered.value;
      rendered.missing.forEach((name) => missing.add(name));
      return template;
    });
    return missing.size > 0
      ? { ok: false, error: `Not launched: no value for ${formatVariableList([...missing])}.` }
      : { ok: true, item: resolved };
  };
}
