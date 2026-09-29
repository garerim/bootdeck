import { useState } from "react";
import { Braces, Copy, Ellipsis, LoaderCircle, Pencil, Play, SearchX, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Page, PageHeader } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { summarizeItemRuns, type ItemRun } from "@/domain/launch/item-run";
import { countItemsByType } from "@/domain/preset/operations";
import { describeRunSummary } from "@/features/launch/format";
import { DeletePresetDialog } from "@/features/presets/delete-preset-dialog";
import { PresetIcon } from "@/features/presets/icons";
import { formatItemSummary } from "@/features/presets/item-types";
import { PresetItemRow } from "@/features/presets/preset-item-row";
import { startLaunch } from "@/features/launch/start-launch";
import { useLaunchStore } from "@/stores/launch-store";
import { useNavigationStore } from "@/stores/navigation-store";
import { usePresetsStore } from "@/stores/presets-store";

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });
const timeFormat = new Intl.DateTimeFormat("en", { timeStyle: "short" });

export function PresetDetailPage({ presetId }: { presetId: string }) {
  const preset = usePresetsStore((state) => state.presets.find((candidate) => candidate.id === presetId));
  const removePreset = usePresetsStore((state) => state.remove);
  const duplicatePreset = usePresetsStore((state) => state.duplicate);
  const run = useLaunchStore((state) => state.runs[presetId]);
  const stopItem = useLaunchStore((state) => state.stopItem);
  const stopAllItems = useLaunchStore((state) => state.stopAllItems);
  const clearRun = useLaunchStore((state) => state.clearRun);
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
  const hasEnabledItems = preset.items.length > disabledCount;
  const launching = run?.inProgress ?? false;
  // Seuls les items encore présents dans le preset comptent (un item a pu être supprimé depuis).
  const itemRuns = preset.items
    .map((item) => run?.items[item.id])
    .filter((itemRun): itemRun is ItemRun => itemRun !== undefined);
  const hasRunningItems = itemRuns.some((itemRun) => itemRun.status === "running");
  const durationMs =
    run?.finishedAt === undefined
      ? undefined
      : new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime();

  function handleDuplicate() {
    const copy = duplicatePreset(presetId);
    if (copy) navigate({ name: "preset-detail", presetId: copy.id });
  }

  async function handleDelete() {
    await stopAllItems(presetId);
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
              <Button
                disabled={launching || !hasEnabledItems}
                title={hasEnabledItems ? undefined : "All items are disabled"}
                onClick={() => startLaunch(preset)}
              >
                {launching ? (
                  <LoaderCircle data-icon="inline-start" className="animate-spin" />
                ) : (
                  <Play data-icon="inline-start" />
                )}
                {launching ? "Launching…" : "Launch"}
              </Button>
            </>
          }
        />
      }
    >
      {preset.variables.length > 0 && (
        <p className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <Braces className="size-3.5" aria-hidden />
          Asks at launch:
          {preset.variables.map((variable) => (
            <span key={variable.key} className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-foreground">
              {`{${variable.key}}`}
            </span>
          ))}
        </p>
      )}

      <section aria-labelledby="launch-order-title">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h2 id="launch-order-title" className="text-sm font-semibold">
            Launch order
          </h2>
          {run ? (
            <div className="flex items-baseline gap-2 text-xs">
              <p role="status" aria-live="polite" className="font-medium">
                {describeRunSummary(summarizeItemRuns(itemRuns), launching, durationMs)}
                <span className="font-normal text-muted-foreground">
                  {" "}
                  · started {timeFormat.format(new Date(run.startedAt))}
                </span>
              </p>
              {!launching && !hasRunningItems && (
                <button
                  type="button"
                  onClick={() => clearRun(presetId)}
                  className="text-muted-foreground underline-offset-2 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  Clear
                </button>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {formatItemSummary(countItemsByType(preset.items))}
              {disabledCount > 0 && ` · ${disabledCount} disabled`}
            </p>
          )}
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
              <PresetItemRow
                key={item.id}
                item={item}
                position={index + 1}
                run={run?.items[item.id]}
                values={run?.values}
                canRun={!launching}
                onRun={() => startLaunch(preset, item.id)}
                onStop={() => void stopItem(presetId, item.id)}
              />
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
        onConfirm={() => void handleDelete()}
      />
    </Page>
  );
}
