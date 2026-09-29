import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";

interface AppShellProps {
  /** Bandeau global affiché au-dessus de la page (erreurs, informations). */
  banner?: ReactNode;
  children: ReactNode;
}

export function AppShell({ banner, children }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        {banner}
        <div className="min-h-0 flex-1">{children}</div>
      </main>
    </div>
  );
}
