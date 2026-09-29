import {
  PRESET_ITEM_TYPES,
  PRESET_NAME_MAX_LENGTH,
  type Preset,
  type PresetItemType,
} from "@/domain/preset/schema";

/**
 * Opérations pures sur les presets.
 *
 * L'heure et la génération d'ids sont injectées plutôt qu'appelées directement
 * (`new Date()`, `crypto.randomUUID()`) : les tests peuvent ainsi fixer leurs
 * valeurs et vérifier un résultat exact.
 */

export type ItemCounts = Record<PresetItemType, number>;

export function countItemsByType(items: Preset["items"]): ItemCounts {
  const counts = Object.fromEntries(PRESET_ITEM_TYPES.map((type) => [type, 0])) as ItemCounts;
  for (const item of items) counts[item.type] += 1;
  return counts;
}

const COPY_SUFFIX = " (copy)";

export interface DuplicateOptions {
  now: Date;
  newId: () => string;
}

/** Copie indépendante : nouveaux ids (preset et items), nouvelles dates, nom suffixé. */
export function duplicatePreset(preset: Preset, { now, newId }: DuplicateOptions): Preset {
  const timestamp = now.toISOString();
  const copy = structuredClone(preset);
  return {
    ...copy,
    id: newId(),
    name: copyName(preset.name),
    items: copy.items.map((item) => ({ ...item, id: newId() })),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/** Tronque le nom d'origine si besoin pour que la copie reste sous la longueur maximale. */
function copyName(name: string): string {
  const base = name.slice(0, PRESET_NAME_MAX_LENGTH - COPY_SUFFIX.length).trimEnd();
  return `${base}${COPY_SUFFIX}`;
}
