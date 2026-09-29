import { z } from "zod";
import {
  absolutePath,
  displayName,
  httpUrl,
  programArgument,
  programPath,
  shellCommand,
  templatable,
} from "@/domain/preset/fields";
import { templateFields } from "@/domain/preset/item-fields";
import { formatVariableList, templateVariables } from "@/domain/variables/template";
import {
  MAX_VARIABLES_PER_PRESET,
  VariableDefinitionSchema,
  defaultValueProblem,
} from "@/domain/variables/variables";

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

interface ItemFieldRules {
  program: z.ZodType<string>;
  argument: z.ZodType<string>;
  folder: z.ZodType<string>;
  url: z.ZodType<string>;
  command: z.ZodType<string>;
}

/** Même structure d'items, avec des règles de champ différentes selon l'usage. */
function itemSchema(rules: ItemFieldRules) {
  return z.discriminatedUnion("type", [
    z.object({
      ...itemBase,
      type: z.literal("application"),
      config: z.object({
        path: rules.program,
        // Un tableau plutôt qu'une chaîne : chaque argument est transmis tel quel,
        // sans shell, donc sans problème de guillemets ni d'injection.
        args: z.array(rules.argument).max(64, "Too many arguments"),
        workingDirectory: rules.folder.optional(),
      }),
    }),
    z.object({
      ...itemBase,
      type: z.literal("url"),
      config: z.object({ url: rules.url }),
    }),
    z.object({
      ...itemBase,
      type: z.literal("folder"),
      config: z.object({ path: rules.folder }),
    }),
    z.object({
      ...itemBase,
      type: z.literal("command"),
      config: z.object({
        command: rules.command,
        // Absent : la commande s'exécutera dans le dossier personnel.
        workingDirectory: rules.folder.optional(),
      }),
    }),
  ]);
}

/**
 * Item prêt à être exécuté : aucune variable, chaque valeur strictement validée.
 * Utilisé au lancement, après le remplacement des variables.
 *
 * Union discriminée sur `type` : Zod choisit le bon schéma selon ce champ,
 * et TypeScript restreint le type de `config` après un test sur `item.type`.
 */
export const PresetItemSchema = itemSchema({
  program: programPath,
  argument: programArgument,
  folder: absolutePath,
  url: httpUrl,
  command: shellCommand,
});

/**
 * Item tel qu'enregistré : un champ peut contenir des variables (`{port}`).
 * Sans variable, la règle stricte s'applique quand même dès l'enregistrement.
 */
export const StoredPresetItemSchema = itemSchema({
  program: templatable(programPath, 4096),
  argument: templatable(programArgument, 4096),
  folder: templatable(absolutePath, 4096),
  url: templatable(httpUrl, 2048),
  command: templatable(shellCommand, 2000),
});

/** Liste des types, dans l'ordre d'affichage de l'interface. */
export const PRESET_ITEM_TYPES = PresetItemSchema.options.map((option) => option.shape.type.value);

export const PresetSchema = z
  .object({
    id: z.uuid(),
    name: displayName(PRESET_NAME_MAX_LENGTH),
    description: z.string().trim().max(200, "Description must be at most 200 characters").optional(),
    icon: z.string().trim().min(1).max(16, "Icon must be a single emoji").optional(),
    /** Valeurs demandées au lancement, utilisables dans les items sous la forme `{key}`. */
    variables: z
      .array(VariableDefinitionSchema)
      .max(MAX_VARIABLES_PER_PRESET, `A preset can declare at most ${MAX_VARIABLES_PER_PRESET} variables`),
    // L'ordre du tableau est l'ordre d'exécution (pas de champ `order` séparé).
    items: z
      .array(StoredPresetItemSchema)
      .max(MAX_ITEMS_PER_PRESET, `A preset can contain at most ${MAX_ITEMS_PER_PRESET} items`),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .superRefine((preset, ctx) => {
    for (const index of duplicateIndexes(preset.items)) {
      ctx.addIssue({ code: "custom", message: "Duplicate item id", path: ["items", index, "id"] });
    }

    // Variables : noms uniques, valeurs par défaut cohérentes
    const declared = new Set<string>();
    preset.variables.forEach((variable, index) => {
      if (declared.has(variable.key)) {
        ctx.addIssue({ code: "custom", message: "This name is already used", path: ["variables", index, "key"] });
      }
      const problem = defaultValueProblem(variable, declared);
      if (problem) {
        ctx.addIssue({ code: "custom", message: problem, path: ["variables", index, "defaultValue"] });
      }
      declared.add(variable.key);
    });

    // Items : chaque variable utilisée doit être déclarée
    preset.items.forEach((item, index) => {
      for (const field of templateFields(item)) {
        const unknown = templateVariables(field.value).filter((name) => !declared.has(name));
        if (unknown.length > 0) {
          ctx.addIssue({
            code: "custom",
            message: `Unknown variable ${formatVariableList(unknown)} (use {{ and }} for literal braces)`,
            path: ["items", index, ...field.path],
          });
        }
      }
    });
  });

/**
 * Version du format de fichier. À incrémenter, avec une migration, à chaque
 * changement incompatible du modèle.
 * - v1 : presets et items.
 * - v2 : variables ; les champs des items deviennent des modèles (`{nom}`).
 */
export const CURRENT_SCHEMA_VERSION = 2;

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
