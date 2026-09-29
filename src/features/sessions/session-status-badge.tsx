import { CircleAlert, CircleCheck, CircleStop, LoaderCircle, type LucideIcon } from "lucide-react";
import type { SessionStatus } from "@/domain/session/session";
import { cn } from "@/lib/utils";

const STATUS: Record<SessionStatus, { label: string; icon: LucideIcon; className: string }> = {
  running: { label: "Running", icon: LoaderCircle, className: "text-foreground [&>svg]:animate-spin" },
  completed: { label: "Completed", icon: CircleCheck, className: "text-emerald-600 dark:text-emerald-400" },
  "completed-with-errors": { label: "With errors", icon: CircleAlert, className: "text-destructive" },
  ended: { label: "Ended", icon: CircleStop, className: "text-muted-foreground" },
};

export function SessionStatusBadge({ status }: { status: SessionStatus }) {
  const { label, icon: Icon, className } = STATUS[status];
  return (
    <span className={cn("flex shrink-0 items-center gap-1.5 text-xs font-medium", className)}>
      <Icon className="size-4" aria-hidden />
      {label}
    </span>
  );
}
