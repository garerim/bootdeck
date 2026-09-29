import { useState } from "react";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { BrowseButton } from "@/features/presets/editor/browse-button";
import { itemFieldKey, type FieldErrors, type ItemDraft } from "@/features/presets/editor/draft";
import { TextField } from "@/features/presets/editor/text-field";
import { ItemTypeIcon } from "@/features/presets/icons";
import { ITEM_TYPE_META } from "@/features/presets/item-types";
import { cn } from "@/lib/utils";

interface ItemEditorProps {
  item: ItemDraft;
  position: number;
  total: number;
  errors: FieldErrors;
  autoFocus: boolean;
  onChange: (patch: Partial<ItemDraft>) => void;
  onMove: (offset: -1 | 1) => void;
  onRemove: () => void;
}

export function ItemEditor({ item, position, total, errors, autoFocus, onChange, onMove, onRemove }: ItemEditorProps) {
  const meta = ITEM_TYPE_META[item.type];
  const [pickerErrors, setPickerErrors] = useState<Partial<Record<PathField, string>>>({});
  const fieldId = (field: keyof ItemDraft) => `${item.id}-${field}`;
  const error = (field: keyof ItemDraft) =>
    errors[itemFieldKey(item.id, field)] ?? (isPathField(field) ? pickerErrors[field] : undefined);

  /** Bouton « Parcourir… » d'un champ chemin : le chemin choisi remplace la valeur. */
  const browse = (field: PathField, kind: "folder" | "program") => (
    <BrowseButton
      kind={kind}
      value={item[field]}
      onPicked={(path) => {
        setPickerErrors((current) => ({ ...current, [field]: undefined }));
        onChange(field === "path" ? { path } : { workingDirectory: path });
      }}
      onError={(message) => setPickerErrors((current) => ({ ...current, [field]: message }))}
    />
  );

  return (
    <div className={cn("rounded-xl border bg-card", !item.enabled && "bg-muted/40")}>
      <div className="flex items-center gap-2.5 border-b px-3 py-2">
        <span className="w-4 text-right text-xs tabular-nums text-muted-foreground">{position}</span>
        <ItemTypeIcon type={item.type} className="size-7" />
        <span className="text-sm font-medium">{meta.label}</span>

        <div className="ml-auto flex items-center gap-1">
          <label className="mr-2 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <Switch size="sm" checked={item.enabled} onCheckedChange={(enabled) => onChange({ enabled })} />
            Enabled
          </label>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Move up"
            title="Move up"
            disabled={position === 1}
            onClick={() => onMove(-1)}
          >
            <ChevronUp />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Move down"
            title="Move down"
            disabled={position === total}
            onClick={() => onMove(1)}
          >
            <ChevronDown />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Remove item"
            title="Remove item"
            onClick={onRemove}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-2">
        <TextField
          id={fieldId("name")}
          label="Name"
          value={item.name}
          onChange={(name) => onChange({ name })}
          error={error("name")}
          placeholder={NAME_PLACEHOLDERS[item.type]}
          autoFocus={autoFocus}
        />

        {item.type === "application" && (
          <>
            <TextField
              id={fieldId("path")}
              label="Program"
              value={item.path}
              onChange={(path) => onChange({ path })}
              error={error("path")}
              placeholder="code, wt, or C:\…\app.exe"
              action={browse("path", "program")}
              mono
            />
            <TextField
              id={fieldId("argumentsText")}
              label="Arguments"
              value={item.argumentsText}
              onChange={(argumentsText) => onChange({ argumentsText })}
              error={error("argumentsText")}
              description='Separated by spaces. Use "quotes" around values with spaces.'
              placeholder="-d ."
              optional
              mono
            />
            <TextField
              id={fieldId("workingDirectory")}
              label="Working directory"
              value={item.workingDirectory}
              onChange={(workingDirectory) => onChange({ workingDirectory })}
              error={error("workingDirectory")}
              placeholder="~/Projects/my-app"
              action={browse("workingDirectory", "folder")}
              optional
              mono
            />
          </>
        )}

        {item.type === "url" && (
          <TextField
            id={fieldId("url")}
            label="URL"
            value={item.url}
            onChange={(url) => onChange({ url })}
            error={error("url")}
            placeholder="https://…"
            type="url"
            mono
          />
        )}

        {item.type === "folder" && (
          <TextField
            id={fieldId("path")}
            label="Folder"
            value={item.path}
            onChange={(path) => onChange({ path })}
            error={error("path")}
            placeholder="~/Projects/my-app"
            action={browse("path", "folder")}
            mono
          />
        )}

        {item.type === "command" && (
          <>
            <TextField
              id={fieldId("command")}
              label="Command"
              value={item.command}
              onChange={(command) => onChange({ command })}
              error={error("command")}
              placeholder="npm run dev"
              mono
            />
            <TextField
              id={fieldId("workingDirectory")}
              label="Working directory"
              value={item.workingDirectory}
              onChange={(workingDirectory) => onChange({ workingDirectory })}
              error={error("workingDirectory")}
              description="Defaults to your home folder."
              placeholder="~/Projects/my-app"
              action={browse("workingDirectory", "folder")}
              optional
              mono
            />
          </>
        )}
      </div>
    </div>
  );
}

/** Champs qui contiennent un chemin, et donc un bouton « Parcourir… ». */
type PathField = "path" | "workingDirectory";

function isPathField(field: keyof ItemDraft): field is PathField {
  return field === "path" || field === "workingDirectory";
}

const NAME_PLACEHOLDERS: Record<ItemDraft["type"], string> = {
  application: "VS Code",
  url: "Supabase",
  folder: "Project folder",
  command: "Dev server",
};
