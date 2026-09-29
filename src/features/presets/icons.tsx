import { Layers } from "lucide-react";
import type { PresetItemType } from "@/domain/preset/schema";
import { ITEM_TYPE_META } from "@/features/presets/item-types";
import { cn } from "@/lib/utils";

const TILE_SIZES = {
  sm: "size-8 rounded-md text-base",
  md: "size-10 rounded-lg text-xl",
} as const;

/** Emoji du preset dans une tuile, ou une icône neutre s'il n'en a pas. */
export function PresetIcon({ icon, size = "md" }: { icon?: string; size?: keyof typeof TILE_SIZES }) {
  return (
    <div className={cn("grid shrink-0 place-items-center bg-muted", TILE_SIZES[size])} aria-hidden>
      {icon ?? <Layers className="size-4 text-muted-foreground" />}
    </div>
  );
}

export function ItemTypeIcon({ type, className }: { type: PresetItemType; className?: string }) {
  const Icon = ITEM_TYPE_META[type].icon;
  return (
    <div className={cn("grid size-8 shrink-0 place-items-center rounded-md bg-muted", className)} aria-hidden>
      <Icon className="size-4 text-muted-foreground" />
    </div>
  );
}
