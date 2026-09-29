import { z } from "zod";
import {
  absolutePath,
  displayName,
  httpUrl,
  programArgument,
  programPath,
  shellCommand,
} from "@/domain/preset/fields";

/**
 * Modèle de données des presets.
 *
 * Les schémas Zod sont la source de vérité : les types TypeScript en sont
 * déduits (`z.infer`), jamais écrits à la main. Validation au runtime et
 * typage à la compilation ne peuvent donc pas diverger.
 */

/** Garde-fou : un preset qui ouvrirait 500 onglets est presque sûrement une erreur. */
export const MAX_ITEMS_PER_PRESET = 50;

export const PRESET_NAME_MAX_LENGTH = 60;

const itemBase = {
  id: z.uuid(),
  name: displayName(80),
  enabled: z.boolean(),
};

export const ApplicationItemSchema = z.object({
  ...itemBase,
  type: z.literal("application"),
  config: z.object({
    path: programPath,
    // Un tableau plutôt qu'une chaîne : chaque argument est transmis tel quel,
    // sans shell, donc sans problème de guillemets ni d'injection.
    args: z.array(programArgument).max(64, "Too many arguments"),
    workingDirectory: absolutePath.optional(),
  }),
});

export const UrlItemSchema = z.object({
  ...itemBase,
  type: z.literal("url"),
  config: z.object({
    url: httpUrl,
  }),
});

export const FolderItemSchema = z.object({
  ...itemBase,
  type: z.literal("folder"),
  config: z.object({
    path: absolutePath,
  }),
});

export const CommandItemSchema = z.object({
  ...itemBase,
  type: z.literal("command"),
  config: z.object({
    command: shellCommand,
    // Absent : la commande s'exécutera dans le dossier personnel.
    workingDirectory: absolutePath.optional(),
  }),
});

/** Union discriminée sur `type` : Zod choisit le bon schéma selon ce champ,
 *  et TypeScript restreint le type de `config` après un test sur `item.type`. */
export const PresetItemSchema = z.discriminatedUnion("type", [
  ApplicationItemSchema,
  UrlItemSchema,
  FolderItemSchema,
  CommandItemSchema,
]);

/** Liste des types, dans l'ordre d'affichage de l'interface. */
export const PRESET_ITEM_TYPES = PresetItemSchema.options.map((option) => option.shape.type.value);

export const PresetSchema = z
  .object({
    id: z.uuid(),
    name: displayName(PRESET_NAME_MAX_LENGTH),
    description: z.string().trim().max(200, "Description must be at most 200 characters").optional(),
    icon: z.string().trim().min(1).max(16, "Icon must be a single emoji").optional(),
    // L'ordre du tableau est l'ordre d'exécution (pas de champ `order` séparé).
    items: z
      .array(PresetItemSchema)
      .max(MAX_ITEMS_PER_PRESET, `A preset can contain at most ${MAX_ITEMS_PER_PRESET} items`),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .superRefine((preset, ctx) => {
    for (const index of duplicateIndexes(preset.items)) {
      ctx.addIssue({ code: "custom", message: "Duplicate item id", path: ["items", index, "id"] });
    }
  });

/** Version du format de fichier. À incrémenter (avec une migration) à chaque
 *  changement incompatible du modèle. */
export const CURRENT_SCHEMA_VERSION = 1;

export const PresetsFileSchema = z
  .object({
    schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
    presets: z.array(PresetSchema),
  })
  .superRefine((file, ctx) => {
    for (const index of duplicateIndexes(file.presets)) {
      ctx.addIssue({ code: "custom", message: "Duplicate preset id", path: ["presets", index, "id"] });
    }
  });

export type PresetItem = z.infer<typeof PresetItemSchema>;
export type PresetItemType = PresetItem["type"];
export type ApplicationItem = z.infer<typeof ApplicationItemSchema>;
export type UrlItem = z.infer<typeof UrlItemSchema>;
export type FolderItem = z.infer<typeof FolderItemSchema>;
export type CommandItem = z.infer<typeof CommandItemSchema>;
export type Preset = z.infer<typeof PresetSchema>;
export type PresetsFile = z.infer<typeof PresetsFileSchema>;

/** Index des éléments dont l'id apparaît déjà plus tôt dans la liste. */
function duplicateIndexes(list: readonly { id: string }[]): number[] {
  const seen = new Set<string>();
  const duplicates: number[] = [];
  list.forEach(({ id }, index) => {
    if (seen.has(id)) duplicates.push(index);
    seen.add(id);
  });
  return duplicates;
}
