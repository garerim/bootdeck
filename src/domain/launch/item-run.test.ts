import { describe, expect, it } from "vitest";
import {
  MAX_OUTPUT_LINES,
  applyItemRunEvent,
  createItemRun,
  summarizeItemRuns,
  type ItemRun,
  type ItemRunEvent,
} from "@/domain/launch/item-run";

function play(...events: ItemRunEvent[]): ItemRun {
  return events.reduce(applyItemRunEvent, createItemRun("item-1"));
}

describe("applyItemRunEvent", () => {
  it("passe par running puis success pour une URL, un dossier ou une application", () => {
    expect(play({ type: "started" }).status).toBe("running");
    expect(play({ type: "started" }, { type: "succeeded" }).status).toBe("success");
  });

  it("conserve la cause d'un échec", () => {
    expect(play({ type: "started" }, { type: "failed", error: "Folder not found: C:\\x" })).toMatchObject({
      status: "failed",
      error: "Folder not found: C:\\x",
    });
  });

  it("garde une commande en cours tant que son processus vit", () => {
    const run = play({ type: "started" }, { type: "process-started", processId: 7 });
    expect(run).toMatchObject({ status: "running", processId: 7 });
  });

  it("réussit sur un code de sortie 0, échoue sinon avec un message explicite", () => {
    const base: ItemRunEvent[] = [{ type: "started" }, { type: "process-started", processId: 7 }];
    expect(play(...base, { type: "exited", code: 0 }).status).toBe("success");
    expect(play(...base, { type: "exited", code: 1 })).toMatchObject({
      status: "failed",
      exitCode: 1,
      error: "Command exited with code 1.",
    });
    expect(play(...base, { type: "exited", code: null }).error).toBe("Command was terminated by the system.");
  });

  it("explique une commande introuvable : programme signalé par le système, ou code 127 des shells Unix", () => {
    const base: ItemRunEvent[] = [{ type: "started" }, { type: "process-started", processId: 7 }];
    expect(play(...base, { type: "exited", code: 1, missingProgram: "npx" }).error).toMatch(/^Command not found: npx\. /);
    expect(play(...base, { type: "exited", code: 127 }).error).toMatch(/^Command not found \(exit code 127\)/);
  });

  it("ne tient compte que du code de sortie : une commande sans aucune sortie réussit", () => {
    const run = play({ type: "started" }, { type: "process-started", processId: 7 }, { type: "exited", code: 0 });
    expect(run).toMatchObject({ status: "success", output: [] });
    expect(run.error).toBeUndefined();
  });

  it("gère une commande si courte que sa fin arrive avant son identifiant", () => {
    const run = play({ type: "started" }, { type: "exited", code: 0 }, { type: "process-started", processId: 7 });
    expect(run).toMatchObject({ status: "success", processId: 7 });
  });

  it("distingue un arrêt demandé par l'utilisateur d'un échec", () => {
    const run = play(
      { type: "started" },
      { type: "process-started", processId: 7 },
      { type: "stop-requested" },
      { type: "exited", code: 1 },
    );
    expect(run.status).toBe("stopped");
  });

  it("laisse la commande en cours si l'arrêt échoue", () => {
    const run = play(
      { type: "started" },
      { type: "process-started", processId: 7 },
      { type: "stop-requested" },
      { type: "stop-failed", error: "Access denied" },
    );
    expect(run).toMatchObject({ status: "running", stopRequested: false, error: "Access denied" });
  });

  it("borne la sortie conservée aux dernières lignes", () => {
    const lines = Array.from({ length: MAX_OUTPUT_LINES + 5 }, (_, index): ItemRunEvent => ({
      type: "output",
      line: { stream: "stdout", text: `line ${index}` },
    }));
    const run = play({ type: "started" }, ...lines);
    expect(run.output).toHaveLength(MAX_OUTPUT_LINES);
    expect(run.output[0]?.text).toBe("line 5");
  });

  it("repart d'un état propre quand l'item est relancé", () => {
    const failed = play({ type: "started" }, { type: "failed", error: "boom" });
    expect(applyItemRunEvent(failed, { type: "started" })).toEqual({ ...createItemRun("item-1"), status: "running" });
  });
});

describe("summarizeItemRuns", () => {
  it("compte les items par statut", () => {
    const runs = [
      play({ type: "started" }, { type: "succeeded" }),
      play({ type: "started" }, { type: "failed", error: "x" }),
      play({ type: "started" }),
      createItemRun("skipped", "skipped"),
    ];
    expect(summarizeItemRuns(runs)).toEqual({
      total: 4,
      pending: 0,
      running: 1,
      success: 1,
      failed: 1,
      skipped: 1,
      stopped: 0,
    });
  });
});
