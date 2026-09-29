import { describe, expect, it } from "vitest";
import { createFakeSystem } from "@/domain/launch/fake-system";
import type { ItemRunEvent } from "@/domain/launch/item-run";
import { runItem, runItems } from "@/domain/launch/run-items";
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
});

describe("runItems", () => {
  it("lance les items dans l'ordre et continue après un échec", async () => {
    const fake = createFakeSystem({
      launchApplication: () => Promise.reject(new Error("Program not found: code")),
    });
    const failed: string[] = [];
    await runItems(
      devSaas,
      fake.system,
      (itemId, event) => {
        if (event.type === "failed") failed.push(itemId);
      },
      () => true,
    );

    expect(failed).toEqual([item(0).id, item(1).id]);
    expect(fake.calls).toEqual([
      "command npm run dev in ~/Projects/my-saas",
      "url http://localhost:3000",
      "url https://supabase.com/dashboard",
      "url https://vercel.com/dashboard",
      "url https://ui.shadcn.com",
    ]);
  });

  it("ignore les items écartés par shouldRun", async () => {
    const fake = createFakeSystem();
    await runItems(devSaas, fake.system, () => {}, (presetItem) => presetItem.type === "url");
    expect(fake.calls.every((call) => call.startsWith("url "))).toBe(true);
    expect(fake.calls).toHaveLength(4);
  });
});
