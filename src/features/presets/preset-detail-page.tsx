import { useState } from "react";
import { Copy, Ellipsis, Pencil, Play, SearchX, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Page, PageHeader } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { countItemsByType } from "@/domain/preset/operations";
import type { PresetItem } from "@/domain/preset/schema";
import { DeletePresetDialog } from "@/features/presets/delete-preset-dialog";
import { ItemTypeIcon, PresetIcon } from "@/features/presets/icons";
import {
  ITEM_TYPE_META,
  formatItemSummary,
  itemTarget,
  itemWorkingDirectory,
} from "@/features/presets/item-types";
import { cn } from "@/lib/utils";
import { useNavigationStore } from "@/stores/navigation-store";
import { usePresetsStore } from "@/stores/presets-store";

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

export function PresetDetailPage({ presetId }: { presetId: string }) {
  const preset = usePresetsStore((state) => state.presets.find((candidate) => candidate.id === presetId));
  const removePreset = usePresetsStore((state) => state.remove);
  const duplicatePreset = usePresetsStore((state) => state.duplicate);
  const navigate = useNavigationStore((state) => state.navigate);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const backToList = { label: "Back to presets", onClick: () => navigate({ name: "presets" }) };

  if (!preset) {
    return (
      <Page header={<PageHeader title="Preset not found" back={backToList} />}>
        <EmptyState
          icon={SearchX}
          title="This preset no longer exists"
          description="It may have been deleted."
          action={<Button onClick={backToList.onClick}>Back to presets</Button>}
        />
      </Page>
    );
  }

  const disabledCount = preset.items.filter((item) => !item.enabled).length;

  function handleDuplicate() {
    const copy = duplicatePreset(presetId);
    if (copy) navigate({ name: "preset-detail", presetId: copy.id });
  }

  function handleDelete() {
    removePreset(presetId);
    navigate({ name: "presets" });
  }

  return (
    <Page
      width="narrow"
      header={
        <PageHeader
          title={preset.name}
          description={preset.description ?? formatItemSummary(countItemsByType(preset.items))}
          leading={<PresetIcon icon={preset.icon} size="sm" />}
          back={backToList}
          actions={
            <>
              <Button variant="outline" onClick={() => navigate({ name: "preset-edit", presetId })}>
                <Pencil data-icon="inline-start" />
                Edit
              </Button>
              {/* modal={false} : évite que le menu bloque le focus du dialogue ouvert depuis lui */}
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="More actions">
                    <Ellipsis />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={handleDuplicate}>
                    <Copy />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
                    <Trash2 />
                    Delete…
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {/* Lancement branché en Phase 6 */}
              <Button disabled title="Not available yet">
                <Play data-icon="inline-start" />
                Launch
              </Button>
            </>
          }
        />
      }
    >
      <section aria-labelledby="launch-order-title">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h2 id="launch-order-title" className="text-sm font-semibold">
            Launch order
          </h2>
          <p className="text-xs text-muted-foreground">
            {formatItemSummary(countItemsByType(preset.items))}
            {disabledCount > 0 && ` · ${disabledCount} disabled`}
          </p>
        </div>

        {preset.items.length === 0 ? (
          <EmptyState
            icon={Pencil}
            title="This preset is empty"
            description="Add applications, URLs, folders or commands to launch them together."
            action={
              <Button variant="outline" onClick={() => navigate({ name: "preset-edit", presetId })}>
                Edit preset
              </Button>
            }
          />
        ) : (
          <ol className="divide-y rounded-xl border bg-card">
            {preset.items.map((item, index) => (
              <PresetItemRow key={item.id} item={item} position={index + 1} />
            ))}
          </ol>
        )}
      </section>

      <p className="mt-6 text-xs text-muted-foreground">
        Created {dateFormat.format(new Date(preset.createdAt))} · Updated{" "}
        {dateFormat.format(new Date(preset.updatedAt))}
      </p>

      <DeletePresetDialog
        preset={preset}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDelete}
      />
    </Page>
  );
}

function PresetItemRow({ item, position }: { item: PresetItem; position: number }) {
  const target = itemTarget(item);
  const workingDirectory = itemWorkingDirectory(item);

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className="w-4 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{position}</span>
      <ItemTypeIcon type={item.type} className={cn(!item.enabled && "opacity-50")} />
      <div className={cn("min-w-0 flex-1", !item.enabled && "opacity-60")}>
        <p className="truncate text-sm font-medium">{item.name}</p>
        <p className="truncate font-mono text-xs text-muted-foreground" title={target}>
          {target}
          {workingDirectory && <span className="text-muted-foreground/70"> · in {workingDirectory}</span>}
        </p>
      </div>
      {item.enabled ? (
        <Badge variant="secondary">{ITEM_TYPE_META[item.type].label}</Badge>
      ) : (
        <Badge variant="outline">Disabled</Badge>
      )}
    </li>
  );
}
