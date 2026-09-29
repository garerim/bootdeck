import { useState } from "react";
import { ChevronRight, History, RotateCw, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Page, PageHeader } from "@/components/layout/page";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { summarizeItemRuns } from "@/domain/launch/item-run";
import { sessionStatus, type Session } from "@/domain/session/session";
import { describeRunSummary } from "@/features/launch/format";
import { ItemRunStatusBadge } from "@/features/launch/item-run-status";
import { startLaunch } from "@/features/launch/start-launch";
import { ItemTypeIcon, PresetIcon } from "@/features/presets/icons";
import { itemTarget, itemWorkingDirectory } from "@/features/presets/item-types";
import { groupSessionsByDay } from "@/features/sessions/format";
import { SessionStatusBadge } from "@/features/sessions/session-status-badge";
import { cn } from "@/lib/utils";
import { useLaunchStore } from "@/stores/launch-store";
import { useNavigationStore } from "@/stores/navigation-store";
import { usePresetsStore } from "@/stores/presets-store";
import { useSessionsStore } from "@/stores/sessions-store";

const timeFormat = new Intl.DateTimeFormat("en", { timeStyle: "short" });

export function RecentPage() {
  const sessions = useSessionsStore((state) => state.sessions);
  const clear = useSessionsStore((state) => state.clear);
  const readOnly = useSessionsStore((state) => state.mode === "read-only");
  const runs = useLaunchStore((state) => state.runs);
  const [confirmClear, setConfirmClear] = useState(false);

  // Session du dernier lancement de chaque preset : son statut est suivi en direct.
  const liveIds = new Set(Object.values(runs).flatMap((run) => (run.session ? [run.session.id] : [])));
  // Parmi elles, celles qui ont encore quelque chose en cours : conservées si on vide l'historique.
  const activeIds = new Set(
    Object.values(runs).flatMap((run) =>
      run.session && (run.inProgress || Object.values(run.items).some((item) => item.status === "running"))
        ? [run.session.id]
        : [],
    ),
  );
  const groups = groupSessionsByDay(sessions, new Date());

  return (
    <Page
      width="narrow"
      header={
        <PageHeader
          title="Recent"
          description={
            sessions.length > 0
              ? `${sessions.length} ${sessions.length === 1 ? "launch" : "launches"}`
              : "Your latest launches"
          }
          actions={
            sessions.length > 0 && !readOnly ? (
              <Button variant="ghost" onClick={() => setConfirmClear(true)}>
                <Trash2 data-icon="inline-start" />
                Clear history
              </Button>
            ) : undefined
          }
        />
      }
    >
      {sessions.length === 0 ? (
        <EmptyState
          icon={History}
          title="No launches yet"
          description="Each time you launch a preset, it appears here with the status of every item."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <section key={group.key} aria-labelledby={`day-${group.key}`}>
              <h2 id={`day-${group.key}`} className="mb-2 text-xs font-medium text-muted-foreground">
                {group.label}
              </h2>
              <ul className="divide-y rounded-xl border bg-card">
                {group.sessions.map((session) => (
                  <SessionRow key={session.id} session={session} live={liveIds.has(session.id)} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear your launch history?</AlertDialogTitle>
            <AlertDialogDescription>
              Past launches are removed from this list. Launches still running are kept. Your presets aren’t
              affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => clear((session) => activeIds.has(session.id))}>
              Clear history
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}

function SessionRow({ session, live }: { session: Session; live: boolean }) {
  const [open, setOpen] = useState(false);
  const preset = usePresetsStore((state) => state.presets.find((candidate) => candidate.id === session.presetId));
  const navigate = useNavigationStore((state) => state.navigate);

  const status = sessionStatus(session, live);
  const summary = summarizeItemRuns(session.items);
  const durationMs = session.finishedAt
    ? new Date(session.finishedAt).getTime() - new Date(session.startedAt).getTime()
    : undefined;
  const values = Object.entries(session.values);
  const detailsId = `session-${session.id}`;

  function launchAgain() {
    if (!preset) return;
    startLaunch(preset, undefined, session.values);
    navigate({ name: "preset-detail", presetId: preset.id });
  }

  return (
    <li>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={detailsId}
          onClick={() => setOpen((shown) => !shown)}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ChevronRight
            className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")}
            aria-hidden
          />
          <PresetIcon icon={session.presetIcon} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline gap-2">
              <span className="truncate text-sm font-medium">{session.presetName}</span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {timeFormat.format(new Date(session.startedAt))}
              </span>
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {describeRunSummary(summary, live && summary.pending > 0, durationMs)}
              {values.length > 0 && (
                <span className="font-mono"> · {values.map(([key, value]) => `${key}=${value}`).join(" ")}</span>
              )}
            </span>
          </span>
        </button>
        <SessionStatusBadge status={status} />
        <Button
          variant="outline"
          size="sm"
          disabled={!preset}
          title={preset ? "Launch this preset again with these values" : "This preset was deleted"}
          onClick={launchAgain}
        >
          <RotateCw data-icon="inline-start" />
          Launch again
        </Button>
      </div>

      {open && (
        <div id={detailsId} className="border-t bg-muted/30 px-3 py-3">
          {session.interrupted && (
            <p className="mb-2 text-xs text-muted-foreground">
              The app was closed while this launch was running; its commands were stopped with it.
            </p>
          )}
          <ol className="flex flex-col gap-2">
            {session.items.map(({ item, status: itemStatus, error }) => {
              const workingDirectory = itemWorkingDirectory(item);
              return (
                <li key={item.id} className="flex items-start gap-3">
                  <ItemTypeIcon type={item.type} className="size-7" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{item.name}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {itemTarget(item)}
                      {workingDirectory && <span className="text-muted-foreground/70"> · in {workingDirectory}</span>}
                    </p>
                    {error && <p className="text-xs text-destructive">{error}</p>}
                  </div>
                  <ItemRunStatusBadge status={itemStatus} type={item.type} />
                </li>
              );
            })}
          </ol>
          {preset && (
            <Button
              variant="link"
              size="sm"
              className="mt-2 h-auto px-0"
              onClick={() => navigate({ name: "preset-detail", presetId: preset.id })}
            >
              Open preset
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
