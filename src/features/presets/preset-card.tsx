import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { countItemsByType } from "@/domain/preset/operations";
import type { Preset } from "@/domain/preset/schema";
import { PresetIcon } from "@/features/presets/icons";
import { formatItemSummary } from "@/features/presets/item-types";

interface PresetCardProps {
  preset: Preset;
  onOpen: () => void;
  onLaunch: () => void;
}

export function PresetCard({ preset, onOpen, onLaunch }: PresetCardProps) {
  const hasEnabledItems = preset.items.some((item) => item.enabled);
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

      <div className="mt-auto flex items-center justify-between gap-2">
        <p className="truncate text-xs text-muted-foreground">
          {formatItemSummary(countItemsByType(preset.items))}
        </p>
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
    </article>
  );
}
