import type { PresetItem } from "@/domain/preset/schema";

/**
 * Champs d'un item qui peuvent contenir des variables : chemins, URL, arguments,
 * dossier de travail, commande. Le nom de l'item n'en fait pas partie (affichage).
 *
 * Défini à un seul endroit, et utilisé par la validation, la résolution et la
 * détection des variables utilisées.
 */

export interface TemplateField {
  /** Chemin dans l'item, ex. `["config", "args", 1]`. */
  path: (string | number)[];
  value: string;
}

export function templateFields(item: PresetItem): TemplateField[] {
  const fields: TemplateField[] = [];
  const add = (value: string | undefined, ...path: (string | number)[]) => {
    if (value !== undefined) fields.push({ path: ["config", ...path], value });
  };
  switch (item.type) {
    case "application":
      add(item.config.path, "path");
      item.config.args.forEach((arg, index) => add(arg, "args", index));
      add(item.config.workingDirectory, "workingDirectory");
      break;
    case "url":
      add(item.config.url, "url");
      break;
    case "folder":
      add(item.config.path, "path");
      break;
    case "command":
      add(item.config.command, "command");
      add(item.config.workingDirectory, "workingDirectory");
      break;
  }
  return fields;
}

/** Copie de l'item où chaque champ « modèle » est transformé par `map`. */
export function mapTemplateFields(item: PresetItem, map: (value: string) => string): PresetItem {
  const optional = (value: string | undefined) => (value === undefined ? undefined : map(value));
  switch (item.type) {
    case "application":
      return {
        ...item,
        config: {
          path: map(item.config.path),
          args: item.config.args.map(map),
          workingDirectory: optional(item.config.workingDirectory),
        },
      };
    case "url":
      return { ...item, config: { url: map(item.config.url) } };
    case "folder":
      return { ...item, config: { path: map(item.config.path) } };
    case "command":
      return {
        ...item,
        config: { command: map(item.config.command), workingDirectory: optional(item.config.workingDirectory) },
      };
  }
}
