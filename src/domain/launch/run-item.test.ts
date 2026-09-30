import { describe, expect, it } from "vitest";
import { createFakeSystem } from "@/domain/launch/fake-system";
import type { ItemRunEvent } from "@/domain/launch/item-run";
import { runItem } from "@/domain/launch/run-item";
import { demoPresets } from "@/domain/preset/fixtures";
import type { PresetItem } from "@/domain/preset/schema";

const devSaas = demoPresets[0]?.items ?? [];

function item(index: number, items: readonly PresetItem[] = devSaas): PresetItem {
  const found = items[index];
  if (!found) throw new Error(`Aucun item à l'index ${index}`);
  return found;
}

describe("runItem", () => {
  it("appelle l'opération système correspondant à chaque type", async () => {
    const fake = createFakeSystem();
    for (const presetItem of devSaas.slice(0, 5)) await runItem(presetItem, fake.system, () => {});
    expect(fake.calls).toEqual([
      "app code . in ~/Projects/my-saas",
      "app wt -d . in ~/Projects/my-saas",
      "command npm run dev in ~/Projects/my-saas",
      "url http://localhost:3000",
      "url https://supabase.com/dashboard",
    ]);
  });

  it("émet started puis succeeded quand l'opération réussit", async () => {
    const events: ItemRunEvent[] = [];
    await runItem(item(4), createFakeSystem().system, (event) => events.push(event));
    expect(events).toEqual([{ type: "started" }, { type: "succeeded" }]);
  });

  it("transforme une erreur du système en événement failed, sans lever d'exception", async () => {
    const fake = createFakeSystem({
      openUrl: () => Promise.reject(new Error("Could not open https://supabase.com/dashboard")),
    });
    const events: ItemRunEvent[] = [];
    await runItem(item(4), fake.system, (event) => events.push(event));
    expect(events[events.length - 1]).toEqual({
      type: "failed",
      error: "Could not open https://supabase.com/dashboard",
    });
  });

  it("relaie la sortie et la fin d'une commande", async () => {
    const fake = createFakeSystem();
    const events: ItemRunEvent[] = [];
    await runItem(item(2), fake.system, (event) => events.push(event));
    fake.emit(1, { type: "stderr", line: "port 3000 already in use" });
    fake.emit(1, { type: "exited", code: 1 });

    expect(events).toEqual([
      { type: "started" },
      { type: "process-started", processId: 1 },
      { type: "output", line: { stream: "stderr", text: "port 3000 already in use" } },
      { type: "exited", code: 1 },
    ]);
  });

  it("relaie le programme introuvable signalé par le système", async () => {
    const fake = createFakeSystem();
    const events: ItemRunEvent[] = [];
    await runItem(item(2), fake.system, (event) => events.push(event));
    fake.emit(1, { type: "exited", code: 1, missingProgram: "npm" });
    expect(events[events.length - 1]).toEqual({ type: "exited", code: 1, missingProgram: "npm" });
  });
});
