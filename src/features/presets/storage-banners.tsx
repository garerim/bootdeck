import { CircleAlert, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePresetsStore } from "@/stores/presets-store";
import { useSessionsStore } from "@/stores/sessions-store";

/** Bandeaux globaux liés aux données : échec d'enregistrement, informations ponctuelles. */
export function StorageBanners() {
  const saveError = usePresetsStore((state) => state.saveError);
  const presetsNotice = usePresetsStore((state) => state.notice);
  const retrySave = usePresetsStore((state) => state.retrySave);
  const dismissPresetsNotice = usePresetsStore((state) => state.dismissNotice);
  const sessionsNotice = useSessionsStore((state) => state.notice);
  const dismissSessionsNotice = useSessionsStore((state) => state.dismissNotice);

  if (!saveError && !presetsNotice && !sessionsNotice) return null;

  return (
    <div className="flex shrink-0 flex-col">
      {saveError && (
        <div
          role="alert"
          className="flex items-center gap-3 border-b border-destructive/20 bg-destructive/10 px-6 py-2 text-sm text-destructive"
        >
          <CircleAlert className="size-4 shrink-0" />
          <p className="min-w-0 flex-1">
            <span className="font-medium">Your changes couldn’t be saved.</span> {saveError}
          </p>
          <Button size="sm" variant="outline" onClick={() => void retrySave()}>
            Retry
          </Button>
        </div>
      )}
      {presetsNotice && <NoticeBanner message={presetsNotice} onDismiss={dismissPresetsNotice} />}
      {sessionsNotice && <NoticeBanner message={sessionsNotice} onDismiss={dismissSessionsNotice} />}
    </div>
  );
}

function NoticeBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div role="status" className="flex items-center gap-3 border-b bg-muted/60 px-6 py-2 text-sm">
      <Info className="size-4 shrink-0 text-muted-foreground" />
      <p className="min-w-0 flex-1 break-all">{message}</p>
      <Button variant="ghost" size="icon-sm" aria-label="Dismiss" onClick={onDismiss}>
        <X />
      </Button>
    </div>
  );
}
