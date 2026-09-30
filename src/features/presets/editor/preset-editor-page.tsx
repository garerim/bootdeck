import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { CircleAlert, Plus, SearchX } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { Page, PageHeader } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { MAX_ITEMS_PER_PRESET, PRESET_ITEM_TYPES, type PresetItemType } from "@/domain/preset/schema";
import {
  emptyItemDraft,
  emptyPresetDraft,
  isDraftModified,
  moveItem,
  presetToDraft,
  validateDraft,
  type ItemDraft,
  type PresetDraft,
  type PresetIdentity,
} from "@/features/presets/editor/draft";
import { EmojiPicker } from "@/features/presets/editor/emoji-picker";
import { ItemEditor } from "@/features/presets/editor/item-editor";
import { TextField } from "@/features/presets/editor/text-field";
import { VariablesEditor } from "@/features/presets/editor/variables-editor";
import { ITEM_TYPE_META } from "@/features/presets/item-types";
import { useShortcut } from "@/hooks/use-shortcut";
import { SHORTCUTS, withShortcut } from "@/lib/shortcuts";
import { useNavigationStore } from "@/stores/navigation-store";
import { usePresetsStore } from "@/stores/presets-store";

const FORM_ID = "preset-form";

interface PresetEditorPageProps {
  /** Absent : création d'un preset. */
  presetId?: string;
  /** Item à mettre en avant à l'ouverture (arrivée depuis « Edit item » d'un item en échec). */
  focusItemId?: string;
}

/** Création (sans `presetId`) ou modification d'un preset. */
export function PresetEditorPage({ presetId, focusItemId }: PresetEditorPageProps) {
  const existing = usePresetsStore((state) =>
    presetId === undefined ? undefined : state.presets.find((preset) => preset.id === presetId),
  );
  const navigate = useNavigationStore((state) => state.navigate);

  if (presetId !== undefined && !existing) {
    return (
      <Page header={<PageHeader title="Preset not found" />}>
        <EmptyState
          icon={SearchX}
          title="This preset no longer exists"
          description="It may have been deleted."
          action={<Button onClick={() => navigate({ name: "presets" })}>Back to presets</Button>}
        />
      </Page>
    );
  }

  return (
    <PresetEditorForm
      initialDraft={existing ? presetToDraft(existing) : emptyPresetDraft()}
      identity={
        existing
          ? { id: existing.id, createdAt: existing.createdAt }
          : { id: crypto.randomUUID(), createdAt: new Date().toISOString() }
      }
      isNew={!existing}
      focusItemId={focusItemId}
    />
  );
}

interface PresetEditorFormProps {
  initialDraft: PresetDraft;
  identity: PresetIdentity;
  isNew: boolean;
  focusItemId?: string;
}

function PresetEditorForm(props: PresetEditorFormProps) {
  const savePreset = usePresetsStore((state) => state.save);
  const navigate = useNavigationStore((state) => state.navigate);
  const setUnsavedChanges = useNavigationStore((state) => state.setUnsavedChanges);
  const formRef = useRef<HTMLFormElement>(null);

  // Valeurs figées au premier rendu : un nouveau rendu du parent ne doit pas
  // réinitialiser le formulaire ni régénérer l'id d'un nouveau preset.
  const [identity] = useState(props.identity);
  const [isNew] = useState(props.isNew);
  const [initialDraft] = useState(props.initialDraft);
  const [draft, setDraft] = useState(props.initialDraft);
  const [submitted, setSubmitted] = useState(false);
  // Item dont le premier champ prend le focus : celui qu'on vient d'ajouter, ou celui à corriger.
  const [focusedItemId, setFocusedItemId] = useState<string | null>(props.focusItemId ?? null);

  // Quitter l'éditeur avec des modifications demande confirmation (UnsavedChangesDialog).
  const modified = isDraftModified(initialDraft, draft);
  useEffect(() => setUnsavedChanges(modified), [modified, setUnsavedChanges]);
  useEffect(() => () => setUnsavedChanges(false), [setUnsavedChanges]);

  // Les erreurs n'apparaissent qu'après une première tentative d'enregistrement,
  // puis se mettent à jour à chaque frappe.
  const errors = useMemo(() => {
    if (!submitted) return {};
    const result = validateDraft(draft, identity, new Date());
    return result.ok ? {} : result.errors;
  }, [draft, identity, submitted]);
  const errorCount = Object.keys(errors).length;

  const cancel = () =>
    navigate(isNew ? { name: "presets" } : { name: "preset-detail", presetId: identity.id });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const result = validateDraft(draft, identity, new Date());
    if (!result.ok) {
      setSubmitted(true);
      return;
    }
    savePreset(result.preset);
    toast.success(isNew ? `Created “${result.preset.name}”` : "Changes saved");
    navigate({ name: "preset-detail", presetId: result.preset.id }, { force: true });
  }

  useShortcut(SHORTCUTS.save, () => formRef.current?.requestSubmit());
  useShortcut(SHORTCUTS.back, cancel);

  const update = (patch: Partial<PresetDraft>) => setDraft((current) => ({ ...current, ...patch }));

  function updateItem(itemId: string, patch: Partial<ItemDraft>) {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    }));
  }

  function addItem(type: PresetItemType) {
    const item = emptyItemDraft(type, crypto.randomUUID());
    setDraft((current) => ({ ...current, items: [...current.items, item] }));
    setFocusedItemId(item.id);
  }

  function moveItemBy(index: number, offset: -1 | 1) {
    setDraft((current) => ({ ...current, items: moveItem(current.items, index, offset) }));
  }

  function removeItem(itemId: string) {
    setDraft((current) => ({ ...current, items: current.items.filter((item) => item.id !== itemId) }));
  }

  const declaredKeys = draft.variables.map((variable) => variable.key.trim()).filter(Boolean);

  const canAddItem = draft.items.length < MAX_ITEMS_PER_PRESET;

  return (
    <Page
      width="narrow"
      header={
        <PageHeader
          title={isNew ? "New preset" : "Edit preset"}
          description={isNew ? "Choose what to open, in which order" : draft.name || "Untitled preset"}
          back={{ label: "Cancel", onClick: cancel }}
          actions={
            <>
              <Button type="button" variant="ghost" onClick={cancel} title={withShortcut("Cancel", SHORTCUTS.back)}>
                Cancel
              </Button>
              {/* Le bouton est hors du <form> (dans l'en-tête) : l'attribut form l'y rattache. */}
              <Button type="submit" form={FORM_ID} title={withShortcut("Save", SHORTCUTS.save)}>
                {isNew ? "Create preset" : "Save changes"}
              </Button>
            </>
          }
        />
      }
    >
      <form ref={formRef} id={FORM_ID} onSubmit={handleSubmit} noValidate className="flex flex-col gap-8">
        {errorCount > 0 && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            <CircleAlert className="size-4 shrink-0" />
            {errorCount === 1 ? "1 field needs your attention." : `${errorCount} fields need your attention.`}
          </div>
        )}

        <section aria-labelledby="general-title" className="flex flex-col gap-4">
          <h2 id="general-title" className="text-sm font-semibold">
            General
          </h2>
          <div className="flex items-start gap-3">
            <Field className="w-auto">
              <FieldLabel htmlFor="preset-icon">Icon</FieldLabel>
              <EmojiPicker id="preset-icon" value={draft.icon} onChange={(icon) => update({ icon })} />
            </Field>
            <TextField
              id="preset-name"
              label="Name"
              value={draft.name}
              onChange={(name) => update({ name })}
              error={errors.name}
              placeholder="Dev SaaS"
              autoFocus={isNew}
            />
          </div>
          <TextField
            id="preset-description"
            label="Description"
            value={draft.description}
            onChange={(description) => update({ description })}
            error={errors.description}
            placeholder="Next.js + Supabase"
            optional
          />
        </section>

        <VariablesEditor
          variables={draft.variables}
          errors={errors}
          onChange={(variables) => update({ variables })}
        />

        <section aria-labelledby="items-title" className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 id="items-title" className="text-sm font-semibold">
                Items
              </h2>
              <p className="text-xs text-muted-foreground">
                Launched from top to bottom.
                {declaredKeys.length > 0 && (
                  <>
                    {" "}
                    Available:{" "}
                    <span className="font-mono">{declaredKeys.map((key) => `{${key}}`).join(" ")}</span>
                  </>
                )}
              </p>
            </div>
            {draft.items.length > 0 && <AddItemMenu onAdd={addItem} disabled={!canAddItem} />}
          </div>

          {errors.items && <FieldError>{errors.items}</FieldError>}

          {draft.items.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6">
              <p className="mb-4 text-center text-sm text-muted-foreground">
                Add the first thing this preset should open.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {PRESET_ITEM_TYPES.map((type) => {
                  const meta = ITEM_TYPE_META[type];
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => addItem(type)}
                      className="flex items-start gap-3 rounded-lg border bg-card p-3 text-left outline-none transition-colors hover:bg-accent/50 focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <meta.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span>
                        <span className="block text-sm font-medium">{meta.label}</span>
                        <span className="block text-xs text-muted-foreground">{meta.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            draft.items.map((item, index) => (
              <ItemEditor
                key={item.id}
                item={item}
                position={index + 1}
                total={draft.items.length}
                errors={errors}
                autoFocus={item.id === focusedItemId}
                onChange={(patch) => updateItem(item.id, patch)}
                onMove={(offset) => moveItemBy(index, offset)}
                onRemove={() => removeItem(item.id)}
              />
            ))
          )}
        </section>
      </form>
    </Page>
  );
}

function AddItemMenu({ onAdd, disabled }: { onAdd: (type: PresetItemType) => void; disabled: boolean }) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={disabled}>
          <Plus data-icon="inline-start" />
          Add item
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {PRESET_ITEM_TYPES.map((type) => {
          const meta = ITEM_TYPE_META[type];
          return (
            <DropdownMenuItem key={type} onSelect={() => onAdd(type)} className="items-start gap-3 py-2">
              <meta.icon className="mt-0.5" />
              <span>
                <span className="block font-medium">{meta.label}</span>
                <span className="block text-xs text-muted-foreground">{meta.description}</span>
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
