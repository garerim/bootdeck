import { useEffect } from "react";
import { LoaderCircle } from "lucide-react";
import { UnsavedChangesDialog } from "@/app/unsaved-changes-dialog";
import { AppShell } from "@/components/layout/app-shell";
import { Toaster } from "@/components/ui/sonner";
import { LaunchDialog } from "@/features/launch/launch-dialog";
import { PresetEditorPage } from "@/features/presets/editor/preset-editor-page";
import { LoadErrorPage } from "@/features/presets/load-error-page";
import { PresetDetailPage } from "@/features/presets/preset-detail-page";
import { PresetsPage } from "@/features/presets/presets-page";
import { StorageBanners } from "@/features/presets/storage-banners";
import { RecentPage } from "@/features/sessions/recent-page";
import { SettingsPage } from "@/features/settings/settings-page";
import { useShortcut } from "@/hooks/use-shortcut";
import { SHORTCUTS } from "@/lib/shortcuts";
import { useNavigationStore, type Route } from "@/stores/navigation-store";
import { usePresetsStore } from "@/stores/presets-store";

export function App() {
  const route = useNavigationStore((state) => state.route);
  const navigate = useNavigationStore((state) => state.navigate);
  const load = usePresetsStore((state) => state.load);
  const filePath = usePresetsStore((state) => state.filePath);
  const ready = load.status === "ready";

  useShortcut(SHORTCUTS.newPreset, () => navigate({ name: "preset-new" }), ready);
  useShortcut(SHORTCUTS.settings, () => navigate({ name: "settings" }), ready);
  useFocusPageTitle(route);

  return (
    <AppShell banner={<StorageBanners />}>
      {load.status === "loading" && <LoadingView />}
      {load.status === "error" && <LoadErrorPage error={load.error} filePath={filePath} />}
      {ready && <RouteView route={route} />}
      {/* Une seule boîte de lancement pour toute l'app, ouverte par startLaunch() */}
      <LaunchDialog />
      <UnsavedChangesDialog />
      <Toaster position="bottom-right" />
    </AppShell>
  );
}

/**
 * À chaque changement d'écran, le focus va au titre du nouvel écran : le clavier
 * repart du haut de la page et un lecteur d'écran annonce où l'on est arrivé.
 * Sauf si l'écran a déjà placé le focus lui-même (champ « Name » d'un nouveau preset).
 */
function useFocusPageTitle(route: Route) {
  useEffect(() => {
    const main = document.querySelector("main");
    const active = document.activeElement;
    if (!main || (active && active !== document.body && main.contains(active))) return;
    main.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
  }, [route]);
}

function LoadingView() {
  // N'apparaît qu'après 300 ms : un chargement rapide (le cas normal) ne fait pas clignoter l'écran.
  return (
    <div role="status" className="grid h-full place-items-center animate-in fade-in delay-300 fill-mode-both">
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
      return <PresetEditorPage key={route.presetId} presetId={route.presetId} focusItemId={route.itemId} />;
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
