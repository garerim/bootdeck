import { CircleAlert, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePresetsStore } from "@/stores/presets-store";

/** Bandeaux globaux liés à la persistance : échec d'enregistrement, information ponctuelle. */
export function StorageBanners() {
  const saveError = usePresetsStore((state) => state.saveError);
  const notice = usePresetsStore((state) => state.notice);
  const retrySave = usePresetsStore((state) => state.retrySave);
  const dismissNotice = usePresetsStore((state) => state.dismissNotice);

  if (!saveError && !notice) return null;

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
      {notice && (
        <div role="status" className="flex items-center gap-3 border-b bg-muted/60 px-6 py-2 text-sm">
          <Info className="size-4 shrink-0 text-muted-foreground" />
          <p className="min-w-0 flex-1 break-all">{notice}</p>
          <Button variant="ghost" size="icon-sm" aria-label="Dismiss" onClick={dismissNotice}>
            <X />
          </Button>
        </div>
      )}
    </div>
  );
}
