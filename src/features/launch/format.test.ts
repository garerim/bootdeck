import { describe, expect, it } from "vitest";
import type { RunSummary } from "@/domain/launch/item-run";
import { describeRunSummary, statusLabel } from "@/features/launch/format";

function summary(counts: Partial<RunSummary>): RunSummary {
  const base = { pending: 0, running: 0, success: 0, failed: 0, skipped: 0, stopped: 0, ...counts };
  const total = base.pending + base.running + base.success + base.failed + base.skipped + base.stopped;
  return { ...base, total };
}

describe("describeRunSummary", () => {
  it("indique la progression pendant le lancement, sans compter les items ignorés", () => {
    expect(describeRunSummary(summary({ success: 2, running: 1, pending: 4, skipped: 1 }), true)).toBe(
      "Launching… 3 of 7",
    );
  });

  it("résume un lancement réussi, commande toujours active comprise", () => {
    expect(describeRunSummary(summary({ success: 6, running: 1 }), false)).toBe("7/7 launched · 1 running");
  });

  it("signale les échecs et les items ignorés", () => {
    expect(describeRunSummary(summary({ success: 5, failed: 1, skipped: 1 }), false)).toBe(
      "5/6 launched · 1 failed · 1 skipped",
    );
  });
});

describe("statusLabel", () => {
  it("adapte le libellé au type d'item", () => {
    expect(statusLabel("success", "url")).toBe("Opened");
    expect(statusLabel("success", "application")).toBe("Launched");
    expect(statusLabel("success", "command")).toBe("Done");
    expect(statusLabel("running", "command")).toBe("Running");
    expect(statusLabel("running", "folder")).toBe("Opening…");
  });
});
