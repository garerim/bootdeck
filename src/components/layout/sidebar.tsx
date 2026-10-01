import { History, Layers, Settings, ShieldCheck, type LucideIcon } from "lucide-react";
import { AppLogo } from "@/components/app-logo";
import { cn } from "@/lib/utils";
import { useNavigationStore, type Route } from "@/stores/navigation-store";

interface NavItem {
  label: string;
  icon: LucideIcon;
  target: Route;
  isActive: (route: Route) => boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Presets",
    icon: Layers,
    target: { name: "presets" },
    isActive: (route) => route.name === "presets" || route.name.startsWith("preset-"),
  },
  {
    label: "Recent",
    icon: History,
    target: { name: "recent" },
    isActive: (route) => route.name === "recent",
  },
  {
    label: "Settings",
    icon: Settings,
    target: { name: "settings" },
    isActive: (route) => route.name === "settings",
  },
];

export function Sidebar() {
  const route = useNavigationStore((state) => state.route);
  const navigate = useNavigationStore((state) => state.navigate);

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center gap-2.5 px-4">
        <AppLogo className="size-7 shrink-0" />
        <span className="text-sm font-semibold tracking-tight">Startdeck</span>
      </div>

      <nav aria-label="Main" className="flex flex-col gap-0.5 px-2 py-2">
        {NAV_ITEMS.map((item) => {
          const active = item.isActive(route);
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => navigate(item.target)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-sm outline-none transition-colors",
                "focus-visible:ring-3 focus-visible:ring-sidebar-ring/50",
                active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <p className="mt-auto flex items-center gap-1.5 px-4 py-3 text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5" />
        Local only · no cloud
      </p>
    </aside>
  );
}
