import { useState } from "react";
import { Play, Square, SquareTerminal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ItemRun } from "@/domain/launch/item-run";
import type { PresetItem } from "@/domain/preset/schema";
import { createVariableResolver } from "@/domain/variables/variables";
import { CommandOutput } from "@/features/launch/command-output";
import { ItemRunStatusBadge } from "@/features/launch/item-run-status";
import { ItemTypeIcon } from "@/features/presets/icons";
import { ITEM_TYPE_META, itemTarget, itemWorkingDirectory } from "@/features/presets/item-types";
import { cn } from "@/lib/utils";

interface PresetItemRowProps {
  item: PresetItem;
  position: number;
  /** État du dernier lancement de cet item, s'il a été lancé. */
  run?: ItemRun;
  /** Valeurs des variables de ce lancement : on affiche alors ce qui a réellement été exécuté. */
  values?: Readonly<Record<string, string>>;
  /** Faux pendant le lancement du preset entier. */
  canRun: boolean;
  onRun: () => void;
  onStop: () => void;
  /** Ouvre l'éditeur sur cet item (proposé quand il a échoué). */
  onEdit: () => void;
}

export function PresetItemRow({ item, position, run, values, canRun, onRun, onStop, onEdit }: PresetItemRowProps) {
  const [showOutput, setShowOutput] = useState(false);
  const resolved = run && values ? createVariableResolver(values)(item) : undefined;
  const shown = resolved?.ok ? resolved.item : item;
  const target = itemTarget(shown);
  const template = itemTarget(item);
  const workingDirectory = itemWorkingDirectory(shown);
  const isCommand = item.type === "command";
  const isRunning = run?.status === "running";
  const canStop = isCommand && isRunning && run.processId !== undefined && !run.stopRequested;
  const hasOutput = isCommand && run !== undefined && run.status !== "pending" && run.status !== "skipped";

  return (
    <li className="px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="w-4 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{position}</span>
        <ItemTypeIcon type={item.type} className={cn(!item.enabled && "opacity-50")} />

        <div className={cn("min-w-0 flex-1", !item.enabled && !run && "opacity-60")}>
          <p className="truncate text-sm font-medium">{item.name}</p>
          <p
            className="truncate font-mono text-xs text-muted-foreground"
            title={target === template ? target : `${target}\nTemplate: ${template}`}
          >
            {target}
            {workingDirectory && <span className="text-muted-foreground/70"> · in {workingDirectory}</span>}
          </p>
          {run?.error && (
            <p className="mt-1 text-xs text-destructive">
              {run.error}
              {hasOutput && !showOutput && run.output.length > 0 && (
                <>
                  {" "}
                  <InlineAction onClick={() => setShowOutput(true)}>View details</InlineAction>
                </>
              )}
              {run.status === "failed" && (
                <>
                  {" "}
                  <InlineAction onClick={onEdit}>Edit item</InlineAction>
                </>
              )}
            </p>
          )}
        </div>

        {run ? (
          <ItemRunStatusBadge status={run.status} type={item.type} />
        ) : item.enabled ? (
          <Badge variant="secondary">{ITEM_TYPE_META[item.type].label}</Badge>
        ) : (
          <Badge variant="outline">Disabled</Badge>
        )}

        <div className="flex shrink-0 items-center">
          {hasOutput && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={showOutput ? "Hide output" : "Show output"}
              title={showOutput ? "Hide output" : "Show output"}
              aria-expanded={showOutput}
              onClick={() => setShowOutput((shown) => !shown)}
            >
              <SquareTerminal />
            </Button>
          )}
          {canStop ? (
            <Button variant="ghost" size="icon-sm" aria-label={`Stop ${item.name}`} title="Stop" onClick={onStop}>
              <Square />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Run ${item.name} only`}
              title="Run this item only"
              disabled={!canRun || isRunning}
              onClick={onRun}
            >
              <Play />
            </Button>
          )}
        </div>
      </div>

      {/* Aligné sur la colonne du nom : numéro (1rem) + icône (2rem) + 2 espacements (1.5rem) */}
      {showOutput && run && (
        <div className="mt-3 pl-18">
          <CommandOutput lines={run.output} label={`Output of ${item.name}`} />
        </div>
      )}
    </li>
  );
}

function InlineAction({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-medium underline underline-offset-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {children}
    </button>
  );
}
