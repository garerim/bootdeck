import { LoaderCircle } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { PresetEditorPage } from "@/features/presets/editor/preset-editor-page";
import { LoadErrorPage } from "@/features/presets/load-error-page";
import { PresetDetailPage } from "@/features/presets/preset-detail-page";
import { PresetsPage } from "@/features/presets/presets-page";
import { StorageBanners } from "@/features/presets/storage-banners";
import { RecentPage } from "@/features/sessions/recent-page";
import { SettingsPage } from "@/features/settings/settings-page";
import { useNavigationStore, type Route } from "@/stores/navigation-store";
import { usePresetsStore } from "@/stores/presets-store";

export function App() {
  const route = useNavigationStore((state) => state.route);
  const load = usePresetsStore((state) => state.load);
  const filePath = usePresetsStore((state) => state.filePath);

  return (
    <AppShell banner={<StorageBanners />}>
      {load.status === "loading" && <LoadingView />}
      {load.status === "error" && <LoadErrorPage error={load.error} filePath={filePath} />}
      {load.status === "ready" && <RouteView route={route} />}
    </AppShell>
  );
}

function LoadingView() {
  return (
    <div role="status" className="grid h-full place-items-center">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />
        Loading presets…
      </p>
    </div>
  );
}

function RouteView({ route }: { route: Route }) {
  // Les `key` forcent un état neuf quand on passe d'un preset à un autre.
  switch (route.name) {
    case "presets":
      return <PresetsPage />;
    case "preset-detail":
      return <PresetDetailPage key={route.presetId} presetId={route.presetId} />;
    case "preset-new":
      return <PresetEditorPage key="new" />;
    case "preset-edit":
      return <PresetEditorPage key={route.presetId} presetId={route.presetId} />;
    case "recent":
      return <RecentPage />;
    case "settings":
      return <SettingsPage />;
    default: {
      // Un écran ajouté à `Route` sans être traité ici ne compile pas.
      const unhandled: never = route;
      return unhandled;
    }
  }
}
