import { AppShell } from "@/components/layout/app-shell";
import { PresetEditorPage } from "@/features/presets/editor/preset-editor-page";
import { PresetDetailPage } from "@/features/presets/preset-detail-page";
import { PresetsPage } from "@/features/presets/presets-page";
import { RecentPage } from "@/features/sessions/recent-page";
import { SettingsPage } from "@/features/settings/settings-page";
import { useNavigationStore, type Route } from "@/stores/navigation-store";

export function App() {
  const route = useNavigationStore((state) => state.route);
  return (
    <AppShell>
      <RouteView route={route} />
    </AppShell>
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
