import type { ComponentProps, ReactNode } from "react";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface TextFieldProps extends Omit<ComponentProps<"input">, "id" | "value" | "onChange"> {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  description?: string;
  optional?: boolean;
  /** Police à chasse fixe, pour les chemins, URLs et commandes. */
  mono?: boolean;
  /** Bouton affiché à droite du champ (ex. « Parcourir… »). */
  action?: ReactNode;
}

export function TextField({
  id,
  label,
  value,
  onChange,
  error,
  description,
  optional = false,
  mono = false,
  action,
  className,
  ...inputProps
}: TextFieldProps) {
  const hintId = `${id}-hint`;
  const showHint = Boolean(error ?? description);

  const input = (
    <Input
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-invalid={error ? true : undefined}
      aria-describedby={showHint ? hintId : undefined}
      autoComplete="off"
      spellCheck={mono ? false : undefined}
      className={cn(mono && "font-mono text-[13px]")}
      {...inputProps}
    />
  );

  return (
    <Field data-invalid={error ? true : undefined} className={className}>
      <FieldLabel htmlFor={id}>
        {label}
        {optional && <span className="font-normal text-muted-foreground">(optional)</span>}
      </FieldLabel>
      {action ? (
        <div className="flex gap-2">
          {input}
          {action}
        </div>
      ) : (
        input
      )}
      {error ? (
        <FieldError id={hintId}>{error}</FieldError>
      ) : (
        description && <FieldDescription id={hintId}>{description}</FieldDescription>
      )}
    </Field>
  );
}
