import { Layers, Plus } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Page, PageHeader } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { PresetCard } from "@/features/presets/preset-card";
import { useLaunchStore } from "@/stores/launch-store";
import { useNavigationStore } from "@/stores/navigation-store";
import { usePresetsStore } from "@/stores/presets-store";

export function PresetsPage() {
  const presets = usePresetsStore((state) => state.presets);
  const navigate = useNavigationStore((state) => state.navigate);
  const launchPreset = useLaunchStore((state) => state.launchPreset);

  const createButton = (
    <Button onClick={() => navigate({ name: "preset-new" })}>
      <Plus data-icon="inline-start" />
      Create preset
    </Button>
  );

  return (
    <Page
      header={
        <PageHeader
          title="Presets"
          description={
            presets.length > 0
              ? `${presets.length} ${presets.length === 1 ? "preset" : "presets"}`
              : "Your work environments, one click away"
          }
          actions={presets.length > 0 ? createButton : undefined}
        />
      }
    >
      {presets.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No presets yet"
          description="A preset opens your editor, terminal, web pages and commands together, in the right order."
          action={createButton}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {presets.map((preset) => (
            <PresetCard
              key={preset.id}
              preset={preset}
              onOpen={() => navigate({ name: "preset-detail", presetId: preset.id })}
              onLaunch={() => {
                // Le lancement continue en arrière-plan ; le détail affiche sa progression.
                void launchPreset(preset);
                navigate({ name: "preset-detail", presetId: preset.id });
              }}
            />
          ))}
        </div>
      )}
    </Page>
  );
}
