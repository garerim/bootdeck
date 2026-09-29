import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MAX_VARIABLES_PER_PRESET,
  VARIABLE_KINDS,
  VARIABLE_KIND_IDS,
  variableLabel,
  type VariableKindId,
} from "@/domain/variables/variables";
import { variableFieldKey, type FieldErrors, type VariableDraft } from "@/features/presets/editor/draft";
import { cn } from "@/lib/utils";

type NewVariable = Omit<VariableDraft, "id">;

/** Variables proposées dans le menu « Add variable » (celles du cahier des charges). */
function suggestions(existing: readonly VariableDraft[]): { label: string; description: string; variable: NewVariable }[] {
  const hasProject = existing.some((variable) => variable.key === "project");
  return [
    {
      label: "Project",
      description: "A project name, like my-saas",
      variable: { key: "project", label: "Project", kind: "text", defaultValue: "" },
    },
    {
      label: "Project path",
      description: "Its folder, like ~/Projects/{project}",
      variable: {
        key: "project_path",
        label: "Project folder",
        kind: "path",
        defaultValue: hasProject ? "~/Projects/{project}" : "",
      },
    },
    {
      label: "Port",
      description: "A local port, like 3000",
      variable: { key: "port", label: "Port", kind: "port", defaultValue: "3000" },
    },
    {
      label: "Custom",
      description: "Any other value to ask at launch",
      variable: { key: "", label: "", kind: "text", defaultValue: "" },
    },
  ];
}

/** `port` déjà pris → `port_2`. */
function uniqueKey(key: string, existing: readonly VariableDraft[]): string {
  if (!key) return key;
  const taken = new Set(existing.map((variable) => variable.key));
  if (!taken.has(key)) return key;
  let suffix = 2;
  while (taken.has(`${key}_${suffix}`)) suffix += 1;
  return `${key}_${suffix}`;
}

const DEFAULT_PLACEHOLDERS: Record<VariableKindId, string> = {
  text: "my-saas",
  path: "~/Projects/{project}",
  port: "3000",
};

interface VariablesEditorProps {
  variables: VariableDraft[];
  errors: FieldErrors;
  onChange: (variables: VariableDraft[]) => void;
}

export function VariablesEditor({ variables, errors, onChange }: VariablesEditorProps) {
  const update = (id: string, patch: Partial<VariableDraft>) =>
    onChange(variables.map((variable) => (variable.id === id ? { ...variable, ...patch } : variable)));
  const add = (variable: NewVariable) =>
    onChange([...variables, { ...variable, key: uniqueKey(variable.key, variables), id: crypto.randomUUID() }]);
  const remove = (id: string) => onChange(variables.filter((variable) => variable.id !== id));

  const addMenu = (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={variables.length >= MAX_VARIABLES_PER_PRESET}>
          <Plus data-icon="inline-start" />
          Add variable
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {suggestions(variables).map((suggestion) => (
          <DropdownMenuItem key={suggestion.label} onSelect={() => add(suggestion.variable)} className="py-2">
            <span>
              <span className="block font-medium">{suggestion.label}</span>
              <span className="block text-xs text-muted-foreground">{suggestion.description}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <section aria-labelledby="variables-title" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 id="variables-title" className="text-sm font-semibold">
            Variables
          </h2>
          <p className="text-xs text-muted-foreground">
            Asked when you launch. Use them in any item field as{" "}
            <code className="font-mono">{"{name}"}</code>.
          </p>
        </div>
        {addMenu}
      </div>

      {variables.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
          No variables. Add one to reuse this preset for several projects.
        </p>
      ) : (
        <div className="rounded-xl border bg-card">
          <div
            aria-hidden
            className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7rem_minmax(0,1.4fr)_2rem] gap-2 border-b px-3 py-2 text-xs font-medium text-muted-foreground"
          >
            <span>Name</span>
            <span>Label</span>
            <span>Type</span>
            <span>Default value</span>
            <span />
          </div>
          <ul className="divide-y">
            {variables.map((variable, index) => (
              <VariableRow
                key={variable.id}
                variable={variable}
                position={index + 1}
                errors={errors}
                onChange={(patch) => update(variable.id, patch)}
                onRemove={() => remove(variable.id)}
              />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

interface VariableRowProps {
  variable: VariableDraft;
  position: number;
  errors: FieldErrors;
  onChange: (patch: Partial<VariableDraft>) => void;
  onRemove: () => void;
}

function VariableRow({ variable, position, errors, onChange, onRemove }: VariableRowProps) {
  const error = (field: keyof VariableDraft) => errors[variableFieldKey(variable.id, field)];
  const rowErrors = (["key", "label", "defaultValue"] as const)
    .map((field) => error(field))
    .filter((message): message is string => Boolean(message));
  const errorId = `${variable.id}-errors`;
  const described = rowErrors.length > 0 ? errorId : undefined;

  return (
    <li className="px-3 py-2">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7rem_minmax(0,1.4fr)_2rem] items-center gap-2">
        <Input
          aria-label={`Variable ${position} name`}
          aria-invalid={error("key") ? true : undefined}
          aria-describedby={described}
          value={variable.key}
          onChange={(event) => onChange({ key: event.target.value })}
          placeholder="project"
          autoComplete="off"
          spellCheck={false}
          className="font-mono text-[13px]"
        />
        <Input
          aria-label={`Variable ${position} label`}
          aria-invalid={error("label") ? true : undefined}
          value={variable.label}
          onChange={(event) => onChange({ label: event.target.value })}
          // Sans libellé, la boîte de lancement affichera celui déduit du nom : on le montre ici.
          placeholder={variable.key ? variableLabel({ key: variable.key, kind: variable.kind }) : "Project"}
          autoComplete="off"
        />
        <Select value={variable.kind} onValueChange={(kind) => onChange({ kind: kind as VariableKindId })}>
          <SelectTrigger aria-label={`Variable ${position} type`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VARIABLE_KIND_IDS.map((kind) => (
              <SelectItem key={kind} value={kind}>
                {VARIABLE_KINDS[kind].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          aria-label={`Variable ${position} default value`}
          aria-invalid={error("defaultValue") ? true : undefined}
          aria-describedby={described}
          value={variable.defaultValue}
          onChange={(event) => onChange({ defaultValue: event.target.value })}
          placeholder={DEFAULT_PLACEHOLDERS[variable.kind]}
          autoComplete="off"
          spellCheck={false}
          className={cn(variable.kind !== "text" && "font-mono text-[13px]")}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove variable ${variable.key || position}`}
          title="Remove variable"
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 />
        </Button>
      </div>
      {rowErrors.length > 0 && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-destructive">
          {rowErrors.join(" · ")}
        </p>
      )}
    </li>
  );
}
