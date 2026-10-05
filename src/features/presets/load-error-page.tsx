import { useState } from "react";
import { Archive, FileWarning, RotateCcw } from "lucide-react";
import { Page, PageHeader } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import type { PresetsLoadError } from "@/domain/preset/storage";
import { usePresetsStore } from "@/stores/presets-store";

const MAX_DETAILS = 8;

/** Titre, explication et détails techniques pour chaque cause d'échec. */
export function describeLoadError(error: PresetsLoadError): {
  title: string;
  description: string;
  details: string[];
} {
  switch (error.kind) {
    case "invalid-json":
      return {
        title: "Your presets file can’t be read",
        description: "It isn’t valid JSON anymore, probably after a manual edit or an interrupted write.",
        details: [error.message],
      };
    case "invalid-data": {
      const details = error.issues
        .slice(0, MAX_DETAILS)
        .map((issue) => `${issue.path || "(file)"}: ${issue.message}`);
      const hidden = error.issues.length - MAX_DETAILS;
      return {
        title: "Your presets file contains invalid data",
        description: "Some values don’t match what Bootdeck expects.",
        details: hidden > 0 ? [...details, `…and ${hidden} more`] : details,
      };
    }
    case "unsupported-version":
      return {
        title: "This presets file comes from a newer version",
        description: `It uses file format version ${error.found}, but this version of Bootdeck only understands version ${error.expected}. Update the app to open it.`,
        details: [],
      };
    case "read-failed":
      return {
        title: "Your presets couldn’t be loaded",
        description: "The presets file exists but couldn’t be opened.",
        details: [error.message],
      };
  }
}

interface LoadErrorPageProps {
  error: PresetsLoadError;
  filePath: string | null;
}

export function LoadErrorPage({ error, filePath }: LoadErrorPageProps) {
  const initialize = usePresetsStore((state) => state.initialize);
  const backupAndReset = usePresetsStore((state) => state.backupAndReset);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const { title, description, details } = describeLoadError(error);

  async function handleBackup() {
    setBusy(true);
    setActionError(null);
    const result = await backupAndReset();
    // En cas de succès, ce composant disparaît : l'app affiche la liste (vide).
    if (!result.ok) {
      setActionError(`The file couldn’t be backed up: ${result.message}`);
      setBusy(false);
    }
  }

  return (
    <Page width="narrow" header={<PageHeader title="Presets" />}>
      <div role="alert" className="flex gap-4 rounded-xl border bg-card p-5">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-destructive/10 text-destructive">
          <FileWarning className="size-5" />
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {description} Bootdeck hasn’t changed it.
          </p>

          {filePath && <p className="mt-3 font-mono text-xs break-all text-muted-foreground">{filePath}</p>}

          {details.length > 0 && (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-muted-foreground select-none">Technical details</summary>
              <ul className="mt-2 flex flex-col gap-1 rounded-lg bg-muted p-3 font-mono text-xs">
                {details.map((detail) => (
                  <li key={detail} className="break-all">
                    {detail}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {actionError && <p className="mt-3 text-sm text-destructive">{actionError}</p>}

          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="outline" disabled={busy} onClick={() => void initialize()}>
              <RotateCcw data-icon="inline-start" />
              Try again
            </Button>
            <Button disabled={busy} onClick={() => void handleBackup()}>
              <Archive data-icon="inline-start" />
              Back up and start fresh
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Backing up renames the current file instead of deleting it, so it can be recovered later.
          </p>
        </div>
      </div>
    </Page>
  );
}
