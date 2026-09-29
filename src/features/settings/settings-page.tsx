import type { ReactNode } from "react";
import { Cpu, HardDrive, Palette, ShieldCheck, type LucideIcon } from "lucide-react";
import { Page, PageHeader } from "@/components/layout/page";
import { isDesktop } from "@/platform/runtime";
import { usePresetsStore } from "@/stores/presets-store";

export function SettingsPage() {
  const filePath = usePresetsStore((state) => state.filePath);
  const desktop = isDesktop();

  return (
    <Page width="narrow" header={<PageHeader title="Settings" />}>
      <div className="divide-y rounded-xl border bg-card">
        <SettingRow icon={Palette} title="Appearance">
          Light or dark, following your system setting.
        </SettingRow>
        <SettingRow icon={ShieldCheck} title="Privacy">
          Presets stay on this device. Nothing is sent to a server.
        </SettingRow>
        <SettingRow icon={HardDrive} title="Storage">
          {desktop ? (
            <span className="font-mono text-xs break-all select-text">{filePath ?? "Not loaded yet"}</span>
          ) : (
            "In memory — changes are lost when the page reloads."
          )}
        </SettingRow>
        <SettingRow icon={Cpu} title="Runtime">
          {desktop ? "Desktop app" : "Browser preview — system actions are unavailable"}
        </SettingRow>
      </div>
    </Page>
  );
}

function SettingRow({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}
