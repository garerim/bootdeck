import { AppWindow, FolderOpen, Globe, SquareTerminal, type LucideIcon } from "lucide-react";
import type { ItemCounts } from "@/domain/preset/operations";
import { PRESET_ITEM_TYPES, type PresetItem, type PresetItemType } from "@/domain/preset/schema";
import { formatArguments } from "@/features/presets/editor/arguments";

/** Présentation de chaque type d'item. Un `Record` sur le type : oublier un type ne compile pas. */
export const ITEM_TYPE_META: Record<
  PresetItemType,
  { label: string; description: string; icon: LucideIcon; singular: string; plural: string }
> = {
  application: {
    label: "Application",
    description: "Open a program, like VS Code or a terminal",
    icon: AppWindow,
    singular: "app",
    plural: "apps",
  },
  url: {
    label: "URL",
    description: "Open a web page in your default browser",
    icon: Globe,
    singular: "URL",
    plural: "URLs",
  },
  folder: {
    label: "Folder",
    description: "Open a folder in the file explorer",
    icon: FolderOpen,
    singular: "folder",
    plural: "folders",
  },
  command: {
    label: "Command",
    description: "Run a shell command, like npm run dev",
    icon: SquareTerminal,
    singular: "command",
    plural: "commands",
  },
};

/** `2 apps · 4 URLs · 1 command` */
export function formatItemSummary(counts: ItemCounts): string {
  const parts = PRESET_ITEM_TYPES.filter((type) => counts[type] > 0).map((type) => {
    const { singular, plural } = ITEM_TYPE_META[type];
    return `${counts[type]} ${counts[type] === 1 ? singular : plural}`;
  });
  return parts.length > 0 ? parts.join(" · ") : "No items";
}

/** Ce que l'item ouvre ou exécute, tel qu'on l'affiche. */
export function itemTarget(item: PresetItem): string {
  switch (item.type) {
    case "application":
      return [item.config.path, formatArguments(item.config.args)].filter(Boolean).join(" ");
    case "url":
      return item.config.url;
    case "folder":
      return item.config.path;
    case "command":
      return item.config.command;
  }
}

export function itemWorkingDirectory(item: PresetItem): string | undefined {
  return item.type === "application" || item.type === "command" ? item.config.workingDirectory : undefined;
}
