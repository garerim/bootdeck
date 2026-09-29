import type { ReactNode } from "react";
import { HardDrive, Monitor, ShieldCheck, type LucideIcon } from "lucide-react";
import { Page, PageHeader } from "@/components/layout/page";
import { isDesktop } from "@/platform/runtime";

export function SettingsPage() {
  return (
    <Page width="narrow" header={<PageHeader title="Settings" />}>
      <div className="divide-y rounded-xl border bg-card">
        <SettingRow icon={Monitor} title="Appearance">
          Light or dark, following your system setting.
        </SettingRow>
        <SettingRow icon={ShieldCheck} title="Privacy">
          Presets stay on this device. Nothing is sent to a server.
        </SettingRow>
        <SettingRow icon={HardDrive} title="Runtime">
          {isDesktop() ? "Desktop app" : "Browser preview — system actions are unavailable"}
        </SettingRow>
      </div>
    </Page>
  );
}

function SettingRow({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}
