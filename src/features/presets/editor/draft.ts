import { PresetSchema, type Preset, type PresetItemType } from "@/domain/preset/schema";
import type { VariableDefinition, VariableKindId } from "@/domain/variables/variables";
import { formatArguments, parseArguments } from "@/features/presets/editor/arguments";

/**
 * État du formulaire d'édition (« brouillon »).
 *
 * Le formulaire manipule des chaînes, telles que l'utilisateur les tape. Le
 * brouillon n'est converti en `Preset` qu'au moment de valider, avec le schéma
 * Zod du domaine : les règles de validation restent définies à un seul endroit.
 */

export interface ItemDraft {
  id: string;
  type: PresetItemType;
  name: string;
  enabled: boolean;
  /** Programme (application) ou dossier (folder). */
  path: string;
  argumentsText: string;
  workingDirectory: string;
  url: string;
  command: string;
}

/** Variable telle que saisie ; `id` ne sert qu'au formulaire (clé React, erreurs). */
export interface VariableDraft {
  id: string;
  key: string;
  label: string;
  kind: VariableKindId;
  defaultValue: string;
}

export interface PresetDraft {
  name: string;
  description: string;
  icon: string;
  variables: VariableDraft[];
  items: ItemDraft[];
}

/** Identité conservée d'une sauvegarde à l'autre. */
export interface PresetIdentity {
  id: string;
  createdAt: string;
}

/**
 * Erreurs indexées par champ : `name`, `items`, ou `items.<itemId>.<champ>`.
 * On indexe par id d'item plutôt que par position pour que l'erreur reste
 * attachée au bon item même après un déplacement.
 */
export type FieldErrors = Record<string, string>;

export type DraftValidation = { ok: true; preset: Preset } | { ok: false; errors: FieldErrors };

export function emptyPresetDraft(): PresetDraft {
  return { name: "", description: "", icon: "", variables: [], items: [] };
}

export function variableToDraft(variable: VariableDefinition, id: string): VariableDraft {
  return {
    id,
    key: variable.key,
    label: variable.label ?? "",
    kind: variable.kind,
    defaultValue: variable.defaultValue ?? "",
  };
}

export function emptyItemDraft(type: PresetItemType, id: string): ItemDraft {
  return {
    id,
    type,
    name: "",
    enabled: true,
    path: "",
    argumentsText: "",
    workingDirectory: "",
    url: "",
    command: "",
  };
}

export function presetToDraft(preset: Preset): PresetDraft {
  return {
    name: preset.name,
    description: preset.description ?? "",
    icon: preset.icon ?? "",
    variables: preset.variables.map((variable) => variableToDraft(variable, crypto.randomUUID())),
    items: preset.items.map((item) => {
      const draft = emptyItemDraft(item.type, item.id);
      draft.name = item.name;
      draft.enabled = item.enabled;
      switch (item.type) {
        case "application":
          draft.path = item.config.path;
          draft.argumentsText = formatArguments(item.config.args);
          draft.workingDirectory = item.config.workingDirectory ?? "";
          break;
        case "url":
          draft.url = item.config.url;
          break;
        case "folder":
          draft.path = item.config.path;
          break;
        case "command":
          draft.command = item.config.command;
          draft.workingDirectory = item.config.workingDirectory ?? "";
          break;
      }
      return draft;
    }),
  };
}

export function validateDraft(draft: PresetDraft, identity: PresetIdentity, now: Date): DraftValidation {
  const candidate = {
    id: identity.id,
    name: draft.name,
    description: optional(draft.description),
    icon: optional(draft.icon),
    variables: draft.variables.map((variable) => ({
      key: variable.key,
      label: optional(variable.label),
      kind: variable.kind,
      defaultValue: optional(variable.defaultValue),
    })),
    items: draft.items.map(itemCandidate),
    createdAt: identity.createdAt,
    updatedAt: now.toISOString(),
  };

  const result = PresetSchema.safeParse(candidate);
  if (result.success) return { ok: true, preset: result.data };

  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = fieldKey(issue.path, draft);
    errors[key] ??= issue.message; // premier message par champ
  }
  return { ok: false, errors };
}

export function variableFieldKey(variableId: string, field: keyof VariableDraft): string {
  return `variables.${variableId}.${field}`;
}

export function itemFieldKey(itemId: string, field: keyof ItemDraft): string {
  return `items.${itemId}.${field}`;
}

/** Déplace l'élément d'index `from` de `offset` positions (sans effet hors limites). */
export function moveItem<T>(items: readonly T[], from: number, offset: number): T[] {
  const to = from + offset;
  const moved = items[from];
  if (moved === undefined || to < 0 || to >= items.length) return [...items];
  const next = items.filter((_, index) => index !== from);
  next.splice(to, 0, moved);
  return next;
}

function itemCandidate(item: ItemDraft) {
  const base = { id: item.id, type: item.type, name: item.name, enabled: item.enabled };
  switch (item.type) {
    case "application":
      return {
        ...base,
        config: {
          path: item.path,
          args: parseArguments(item.argumentsText),
          workingDirectory: optional(item.workingDirectory),
        },
      };
    case "url":
      return { ...base, config: { url: item.url } };
    case "folder":
      return { ...base, config: { path: item.path } };
    case "command":
      return { ...base, config: { command: item.command, workingDirectory: optional(item.workingDirectory) } };
    default: {
      // Si un 5e type d'item est ajouté au modèle, la compilation échoue ici.
      const unhandled: never = item.type;
      return unhandled;
    }
  }
}

/** Un champ facultatif laissé vide devient `undefined`, pas une chaîne vide. */
function optional(value: string): string | undefined {
  return value.trim() === "" ? undefined : value;
}

/** Nom du champ du brouillon correspondant à chaque champ de `config`. */
const CONFIG_FIELDS: Record<string, keyof ItemDraft> = {
  path: "path",
  args: "argumentsText",
  workingDirectory: "workingDirectory",
  url: "url",
  command: "command",
};

/** Traduit un chemin d'erreur Zod (`["items", 2, "config", "url"]`) en clé de champ du formulaire. */
function fieldKey(path: readonly PropertyKey[], draft: PresetDraft): string {
  const [root, index, section, field] = path;
  if (root === "variables" && typeof index === "number") {
    return `variables.${draft.variables[index]?.id ?? String(index)}.${String(section)}`;
  }
  if (root !== "items" || typeof index !== "number") return String(root ?? "form");

  const itemId = draft.items[index]?.id ?? String(index);
  if (section === "config" && typeof field === "string") {
    return `items.${itemId}.${CONFIG_FIELDS[field] ?? field}`;
  }
  return `items.${itemId}.${String(section)}`;
}
