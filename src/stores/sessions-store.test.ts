import { describe, expect, it } from "vitest";
import { createLaunchEngine } from "@/domain/launch/engine";
import { createFakeSystem } from "@/domain/launch/fake-system";
import { demoPresets } from "@/domain/preset/fixtures";
import type { Preset } from "@/domain/preset/schema";
import { parseSessionsFile } from "@/domain/session/sessions-file";
import type { FileStorage } from "@/domain/storage/file-storage";
import { createMemoryFileStorage } from "@/platform/mock/memory-file-storage";
import { createLaunchStore } from "@/stores/launch-store";
import { createSessionsStore, recordSessions } from "@/stores/sessions-store";

function demoPreset(index: number): Preset {
  const preset = demoPresets[index];
  if (!preset) throw new Error(`Aucun preset de démonstration à l'index ${index}`);
  return structuredClone(preset);
}

function spyStorage(initialContent: string | null = null) {
  const memory = createMemoryFileStorage(initialContent, "sessions");
  const written: string[] = [];
  const storage: FileStorage = {
    ...memory,
    write: async (content) => {
      written.push(content);
      await memory.write(content);
    },
  };
  return { storage, written };
}

async function setup(initialContent: string | null = null) {
  const fake = createFakeSystem();
  const launch = createLaunchStore(createLaunchEngine(fake.system));
  const spy = spyStorage(initialContent);
  const sessions = createSessionsStore(spy.storage);
  await sessions.getState().initialize();
  const stop = recordSessions(launch, sessions);
  return { fake, launch, sessions, stop, ...spy };
}

const lastWritten = (written: string[]) => {
  const parsed = parseSessionsFile(written[written.length - 1] ?? "");
  if (!parsed.ok) throw new Error("fichier de sessions invalide");
  return parsed.sessions;
};

describe("enregistrement des sessions", () => {
  it("enregistre un lancement complet comme session", async () => {
    const { launch, sessions, written } = await setup();
    await launch.getState().launchPreset(demoPreset(0));
    await sessions.getState().flush();

    expect(sessions.getState().sessions).toHaveLength(1);
    expect(lastWritten(written)[0]).toMatchObject({ presetName: "Dev SaaS" });
  });

  it("ne réécrit pas le fichier pour chaque ligne de sortie, seulement quand la session change", async () => {
    const { fake, launch, sessions, written } = await setup();
    await launch.getState().launchPreset(demoPreset(0));
    await sessions.getState().flush();
    const writesAfterLaunch = written.length;

    for (let line = 0; line < 50; line++) fake.emit(1, { type: "stdout", line: `compiled ${line}` });
    await sessions.getState().flush();
    expect(written).toHaveLength(writesAfterLaunch);

    fake.emit(1, { type: "exited", code: 1 });
    await sessions.getState().flush();
    expect(written).toHaveLength(writesAfterLaunch + 1);
    expect(lastWritten(written)[0]?.items[2]).toMatchObject({ status: "failed", exitCode: 1 });
  });

  it("n'enregistre pas un item lancé seul", async () => {
    const { launch, sessions } = await setup();
    const devSaas = demoPreset(0);
    await launch.getState().launchItem(devSaas, devSaas.items[4]?.id ?? "");
    expect(sessions.getState().sessions).toEqual([]);
  });
});

describe("chargement de l'historique", () => {
  it("met de côté un historique illisible et repart de zéro, en le signalant", async () => {
    const { sessions, storage } = await setup("{ corrupted");
    expect(sessions.getState()).toMatchObject({ mode: "ready", sessions: [] });
    expect(sessions.getState().notice).toContain("memory://sessions.invalid-1.json");
    expect((await storage.read()).content).toBeNull();
  });

  it("n'écrit jamais dans un historique d'une version plus récente", async () => {
    const { launch, sessions, written } = await setup('{ "schemaVersion": 99, "sessions": [] }');
    await launch.getState().launchPreset(demoPreset(1));
    await sessions.getState().flush();

    expect(sessions.getState().mode).toBe("read-only");
    expect(written).toEqual([]);
  });
});
