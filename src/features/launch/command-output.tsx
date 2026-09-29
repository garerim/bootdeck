import { useEffect, useRef } from "react";
import type { OutputLine } from "@/domain/launch/item-run";
import { cn } from "@/lib/utils";

/** Sortie d'une commande, qui défile d'elle-même tant qu'on est en bas. */
export function CommandOutput({ lines, label }: { lines: readonly OutputLine[]; label: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  useEffect(() => {
    const container = containerRef.current;
    if (container && stickToBottom.current) container.scrollTop = container.scrollHeight;
  }, [lines]);

  return (
    <div
      ref={containerRef}
      role="log"
      aria-label={label}
      tabIndex={0}
      onScroll={(event) => {
        const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
        stickToBottom.current = scrollHeight - scrollTop - clientHeight < 24;
      }}
      className="max-h-64 overflow-auto rounded-lg bg-muted px-3 py-2 font-mono text-xs leading-relaxed outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {lines.length === 0 ? (
        <p className="text-muted-foreground">No output yet.</p>
      ) : (
        lines.map((line, index) => (
          <p
            key={index}
            className={cn("break-all whitespace-pre-wrap", line.stream === "stderr" && "text-destructive")}
          >
            {line.text || " "}
          </p>
        ))
      )}
    </div>
  );
}
