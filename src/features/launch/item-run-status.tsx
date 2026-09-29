import { CircleCheck, CircleDashed, CircleMinus, CircleStop, CircleX, LoaderCircle, type LucideIcon } from "lucide-react";
import type { ItemRunStatus } from "@/domain/launch/item-run";
import type { PresetItemType } from "@/domain/preset/schema";
import { statusLabel } from "@/features/launch/format";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<ItemRunStatus, { icon: LucideIcon; className: string }> = {
  pending: { icon: CircleDashed, className: "text-muted-foreground" },
  running: { icon: LoaderCircle, className: "text-foreground [&>svg]:animate-spin" },
  success: { icon: CircleCheck, className: "text-emerald-600 dark:text-emerald-400" },
  failed: { icon: CircleX, className: "text-destructive" },
  skipped: { icon: CircleMinus, className: "text-muted-foreground" },
  stopped: { icon: CircleStop, className: "text-muted-foreground" },
};

/** Statut d'un item : icône ET texte, pour ne jamais reposer sur la couleur seule. */
export function ItemRunStatusBadge({ status, type }: { status: ItemRunStatus; type: PresetItemType }) {
  const { icon: Icon, className } = STATUS_STYLE[status];
  return (
    <span className={cn("flex shrink-0 items-center gap-1.5 text-xs font-medium", className)}>
      <Icon className="size-4" aria-hidden />
      {statusLabel(status, type)}
    </span>
  );
}
