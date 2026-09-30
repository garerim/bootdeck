import { describe, expect, it } from "vitest";
import { createLaunchEngine, type LaunchRuns } from "@/domain/launch/engine";
import { createFakeSystem } from "@/domain/launch/fake-system";
import { detectLaunchNotices, type LaunchNotice } from "@/domain/launch/notices";
import { demoPresets } from "@/domain/preset/fixtures";
import type { Preset } from "@/domain/preset/schema";

const devSaas: Preset = structuredClone(demoPresets[0] as Preset); // 2 apps, 1 commande (index 2), 4 URLs
const commandId = devSaas.items[2]?.id ?? "";

/** Vrai moteur + faux système ; chaque changement d'état passe par `detectLaunchNotices`. */
function observe(overrides: Parameters<typeof createFakeSystem>[0] = {}) {
  const fake = createFakeSystem(overrides);
  const engine = createLaunchEngine(fake.system);
  const notices: LaunchNotice[] = [];
  let previous: LaunchRuns = engine.getRuns();
  engine.subscribe((runs) => {
    notices.push(...detectLaunchNotices(previous, runs));
    previous = runs;
  });
  return { fake, engine, notices };
}

describe("detectLaunchNotices", () => {
  it("ne signale rien pour un lancement réussi, même avec une commande encore en cours", async () => {
    const { engine, notices } = observe();
    await engine.launchPreset(devSaas);
    expect(notices).toEqual([]);
  });

  it("signale une fois la fin d'un lancement avec des échecs", async () => {
    const { engine, notices } = observe({
      openUrl: async () => {
        throw new Error("No browser");
      },
    });
    await engine.launchPreset(devSaas);
    expect(notices).toEqual([{ type: "launch-failed", presetId: devSaas.id, failed: 4, launched: 7 }]);
  });

  it("signale une commande qui échoue après la séquence (ex. serveur de dev qui plante)", async () => {
    const { engine, fake, notices } = observe();
    await engine.launchPreset(devSaas);
    fake.emit(1, { type: "exited", code: 1 });
    expect(notices).toEqual([
      { type: "command-failed", presetId: devSaas.id, itemId: commandId, error: "Command exited with code 1." },
    ]);
  });

  it("ne signale ni une commande qui se termine bien, ni une commande arrêtée par l'utilisateur", async () => {
    const first = observe();
    await first.engine.launchPreset(devSaas);
    first.fake.emit(1, { type: "exited", code: 0 });
    expect(first.notices).toEqual([]);

    const second = observe();
    await second.engine.launchPreset(devSaas);
    await second.engine.stopItem(devSaas.id, commandId);
    expect(second.notices).toEqual([]);
  });

  it("ne confond pas deux lancements successifs du même preset", async () => {
    const { engine } = observe();
    await engine.launchPreset(devSaas);
    const previous = engine.getRuns(); // la commande tourne
    const run = previous[devSaas.id];
    const command = run?.items[commandId];
    if (!run || !command) throw new Error("lancement attendu");

    // Même item en échec, mais dans un autre lancement (autre heure de début) : aucun lien.
    const next: LaunchRuns = {
      [devSaas.id]: {
        ...run,
        startedAt: "2030-01-01T00:00:00.000Z",
        items: { ...run.items, [commandId]: { ...command, status: "failed", error: "Boom" } },
      },
    };
    expect(detectLaunchNotices(previous, next)).toEqual([]);
  });
});
