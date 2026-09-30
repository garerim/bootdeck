import { describe, expect, it } from "vitest";
import { createItemRun } from "@/domain/launch/item-run";
import { buildLaunchReport, planLaunch, validateItem, type ItemResolver } from "@/domain/launch/pipeline";
import type { Preset, PresetItem } from "@/domain/preset/schema";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const url = (n: number, overrides: Partial<PresetItem> = {}): PresetItem =>
  ({ id: id(n), type: "url", name: `Page ${n}`, enabled: true, config: { url: `https://example.com/${n}` }, ...overrides }) as PresetItem;

const command: PresetItem = { id: id(9), type: "command", name: "Dev server", enabled: true, config: { command: "npm run dev" } };

describe("validateItem — validation au lancement, sur la valeur résolue", () => {
  it("accepte un item valide", () => {
    expect(validateItem(url(1))).toEqual({ ok: true, item: url(1) });
  });

  it("refuse une valeur qui ne partirait pas vers le système, avec un message lisible", () => {
    const result = validateItem(url(1, { config: { url: "javascript:alert(1)" } }));
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/^Not launched: /);
  });
});

describe("planLaunch — ordre et état initial", () => {
  it("garde l'ordre choisi dans le preset, et n'exécute que les items actifs", () => {
    const steps = planLaunch([url(3), url(1, { enabled: false }), url(2)]);
    expect(steps.map((step) => step.item.id)).toEqual([id(3), id(1), id(2)]);
    expect(steps.map((step) => [step.initial.status, step.execute])).toEqual([
      ["pending", true],
      ["skipped", false],
      ["pending", true],
    ]);
  });

  it("ne relance pas une commande encore active (pas de second serveur sur le même port)", () => {
    const running = { ...createItemRun(command.id), status: "running" as const, processId: 4 };
    const [step] = planLaunch([command], { previous: { [command.id]: running } });
    expect(step).toMatchObject({ initial: running, execute: false });
  });

  it("marque en échec, sans l'exécuter, un item que la résolution ou la validation refuse", () => {
    const resolve: ItemResolver = (item) =>
      item.id === id(1)
        ? { ok: false, error: "Missing value for {port}." }
        : { ok: true, item: { ...item, config: { url: "not a url" } } as PresetItem };
    const steps = planLaunch([url(1), url(2)], { resolve });
    expect(steps.map((step) => [step.initial.status, step.initial.error, step.execute])).toEqual([
      ["failed", "Missing value for {port}.", false],
      ["failed", expect.stringMatching(/^Not launched: /), false],
    ]);
  });

  it("exécute l'item tel que résolu (variables remplacées), pas le modèle", () => {
    const resolve: ItemResolver = (item) => ({ ok: true, item: { ...item, config: { url: "https://example.com/resolved" } } as PresetItem });
    const [step] = planLaunch([url(1)], { resolve });
    expect(step?.item.config).toEqual({ url: "https://example.com/resolved" });
  });
});

describe("buildLaunchReport", () => {
  it("ordonne les résultats comme le preset, ignore les items supprimés et calcule la durée", () => {
    const preset = { id: id(100), name: "Dev", items: [url(2), url(1)] } as Preset;
    const report = buildLaunchReport(
      preset,
      {
        [id(1)]: { ...createItemRun(id(1)), status: "failed", error: "Boom" },
        [id(2)]: { ...createItemRun(id(2)), status: "success" },
        [id(7)]: { ...createItemRun(id(7)), status: "success" }, // item retiré du preset depuis
      },
      new Date("2026-09-30T10:00:00.000Z"),
      new Date("2026-09-30T10:00:01.250Z"),
    );
    expect(report.items.map((item) => item.itemId)).toEqual([id(2), id(1)]);
    expect(report).toMatchObject({ durationMs: 1250, summary: { total: 2, success: 1, failed: 1 } });
  });
});
