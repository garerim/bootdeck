import { useMemo, useState, type FormEvent } from "react";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Preset } from "@/domain/preset/schema";
import {
  VARIABLE_KINDS,
  createVariableResolver,
  resolveValues,
  variableLabel,
  variablesUsedBy,
} from "@/domain/variables/variables";
import { itemsToLaunch, useLaunchRequestStore } from "@/features/launch/start-launch";
import { TextField } from "@/features/presets/editor/text-field";
import { ItemTypeIcon } from "@/features/presets/icons";
import { itemTarget, itemWorkingDirectory } from "@/features/presets/item-types";
import { launchStore } from "@/stores/launch-store";
import { usePresetsStore } from "@/stores/presets-store";

/** Boîte « valeurs des variables », montée une seule fois dans l'application. */
export function LaunchDialog() {
  const request = useLaunchRequestStore((state) => state.request);
  const close = useLaunchRequestStore((state) => state.close);
  const preset = usePresetsStore((state) =>
    request ? state.presets.find((candidate) => candidate.id === request.presetId) : undefined,
  );

  return (
    <Dialog open={Boolean(request && preset)} onOpenChange={(open) => !open && close()}>
      {request && preset && (
        <LaunchValuesForm
          // Formulaire neuf à chaque ouverture
          key={`${request.presetId}:${request.itemId ?? "all"}`}
          preset={preset}
          itemId={request.itemId}
          onDone={close}
        />
      )}
    </Dialog>
  );
}

interface LaunchValuesFormProps {
  preset: Preset;
  itemId?: string;
  onDone: () => void;
}

function LaunchValuesForm({ preset, itemId, onDone }: LaunchValuesFormProps) {
  const remembered = useLaunchRequestStore((state) => state.lastInputs[preset.id]);
  const remember = useLaunchRequestStore((state) => state.remember);
  const [inputs, setInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      preset.variables.map((variable) => [variable.key, remembered?.[variable.key] ?? variable.defaultValue ?? ""]),
    ),
  );
  const [submitted, setSubmitted] = useState(false);

  const items = useMemo(() => itemsToLaunch(preset, itemId), [preset, itemId]);
  const result = useMemo(() => resolveValues(preset.variables, inputs), [preset.variables, inputs]);
  const errors = submitted && !result.ok ? result.errors : {};

  // Aperçu : ce qui partira réellement vers le système, variables remplacées.
  const preview = useMemo(() => {
    if (!result.ok) return null;
    const resolve = createVariableResolver(result.values);
    return items
      .filter((item) => variablesUsedBy([item]).length > 0)
      .map((item) => {
        const resolved = resolve(item);
        const shown = resolved.ok ? resolved.item : item;
        const workingDirectory = itemWorkingDirectory(shown);
        return { item, target: itemTarget(shown) + (workingDirectory ? ` · in ${workingDirectory}` : "") };
      });
  }, [items, result]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!result.ok) {
      setSubmitted(true);
      return;
    }
    remember(preset.id, inputs);
    onDone();
    const launch = launchStore.getState();
    const options = { values: result.values };
    void (itemId === undefined ? launch.launchPreset(preset, options) : launch.launchItem(preset, itemId, options));
  }

  const target = itemId === undefined ? preset.name : (items[0]?.name ?? preset.name);

  return (
    <DialogContent className="sm:max-w-lg">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <DialogHeader>
          <DialogTitle>Launch {target}</DialogTitle>
          <DialogDescription>Values used for this launch only. The preset isn’t changed.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {preset.variables.map((variable, index) => (
            <TextField
              key={variable.key}
              id={`launch-${variable.key}`}
              label={variableLabel(variable)}
              value={inputs[variable.key] ?? ""}
              onChange={(value) => setInputs((current) => ({ ...current, [variable.key]: value }))}
              error={errors[variable.key]}
              description={`{${variable.key}} · ${VARIABLE_KINDS[variable.kind].hint}`}
              mono={variable.kind !== "text"}
              autoFocus={index === 0}
            />
          ))}
        </div>

        <section aria-labelledby="launch-preview-title" className="flex flex-col gap-2">
          <h3 id="launch-preview-title" className="text-xs font-medium text-muted-foreground">
            Will run
          </h3>
          {preview === null ? (
            <p className="text-xs text-muted-foreground">Fix the values above to see what will run.</p>
          ) : (
            <ul className="flex flex-col gap-1.5 rounded-lg bg-muted p-3">
              {preview.map(({ item, target: resolvedTarget }) => (
                <li key={item.id} className="flex items-center gap-2 text-xs">
                  <ItemTypeIcon type={item.type} className="size-6 bg-background" />
                  <span className="shrink-0 font-medium">{item.name}</span>
                  <span className="truncate font-mono text-muted-foreground" title={resolvedTarget}>
                    {resolvedTarget}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit">
            <Play data-icon="inline-start" />
            Launch
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
