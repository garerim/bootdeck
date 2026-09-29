import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Élément affiché avant le titre (ex. icône du preset). */
  leading?: ReactNode;
  back?: { label: string; onClick: () => void };
  actions?: ReactNode;
}

export function PageHeader({ title, description, leading, back, actions }: PageHeaderProps) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b px-6">
      {back && (
        <Button variant="ghost" size="icon-sm" onClick={back.onClick} aria-label={back.label} title={back.label}>
          <ArrowLeft />
        </Button>
      )}
      {leading}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold leading-tight tracking-tight">{title}</h1>
        {description && <p className="truncate text-xs text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

interface PageProps {
  header: ReactNode;
  children: ReactNode;
  width?: "default" | "narrow";
}

/** En-tête fixe + contenu qui défile. */
export function Page({ header, children, width = "default" }: PageProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      {header}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={cn("mx-auto w-full px-6 py-6", width === "narrow" ? "max-w-3xl" : "max-w-6xl")}>
          {children}
        </div>
      </div>
    </div>
  );
}
