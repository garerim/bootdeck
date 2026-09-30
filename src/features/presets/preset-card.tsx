import { LoaderCircle, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { countItemsByType } from "@/domain/preset/operations";
import type { Preset } from "@/domain/preset/schema";
import { PresetIcon } from "@/features/presets/icons";
import { formatItemSummary } from "@/features/presets/item-types";
import { useLaunchStore } from "@/stores/launch-store";

interface PresetCardProps {
  preset: Preset;
  onOpen: () => void;
  onLaunch: () => void;
}

export function PresetCard({ preset, onOpen, onLaunch }: PresetCardProps) {
  const hasEnabledItems = preset.items.some((item) => item.enabled);
  // Sélecteurs qui renvoient des valeurs simples : la carte ne se redessine que si elles changent.
  const launching = useLaunchStore((state) => state.runs[preset.id]?.inProgress ?? false);
  const runningCount = useLaunchStore((state) => {
    const run = state.runs[preset.id];
    return run ? Object.values(run.items).filter((item) => item.status === "running").length : 0;
  });
  return (
    <article className="group relative flex flex-col gap-4 rounded-xl border bg-card p-4 text-card-foreground transition-colors hover:border-foreground/15 hover:bg-accent/40">
      <div className="flex items-start gap-3">
        <PresetIcon icon={preset.icon} />
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 className="truncate text-sm font-semibold">
            {/* Le bouton s'étend sur toute la carte (::after) : toute la carte est cliquable,
                tout en gardant un vrai bouton accessible au clavier et aux lecteurs d'écran. */}
            <button
              type="button"
              onClick={onOpen}
              className="text-left outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
            >
              {preset.name}
            </button>
          </h2>
          {preset.description && <p className="truncate text-sm text-muted-foreground">{preset.description}</p>}
        </div>
      </div>

      <div className="mt-auto flex items-center gap-2">
        <p className="truncate text-xs text-muted-foreground">
          {formatItemSummary(countItemsByType(preset.items))}
        </p>
        <div className="ml-auto flex items-center gap-2">
          {launching ? (
            <Badge variant="secondary">
              <LoaderCircle className="animate-spin" aria-hidden />
              Launching…
            </Badge>
          ) : (
            runningCount > 0 && (
              <Badge variant="secondary" title="Commands started by this preset are still running">
                <span className="size-1.5 rounded-full bg-emerald-500 motion-safe:animate-pulse" aria-hidden />
                {runningCount} running
              </Badge>
            )
          )}
          {/* relative z-10 : au-dessus du bouton étendu qui couvre la carte */}
          <Button
            size="sm"
            variant="outline"
            className="relative z-10"
            disabled={!hasEnabledItems}
            title={hasEnabledItems ? undefined : "All items are disabled"}
            onClick={onLaunch}
          >
            <Play data-icon="inline-start" />
            Launch
          </Button>
        </div>
      </div>
    </article>
  );
}
