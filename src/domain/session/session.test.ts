import { describe, expect, it } from "vitest";
import { createLaunchEngine } from "@/domain/launch/engine";
import { createFakeSystem } from "@/domain/launch/fake-system";
import { demoPresets } from "@/domain/preset/fixtures";
import type { Preset } from "@/domain/preset/schema";
import {
  latestValues,
  markInterrupted,
  sessionFromRun,
  sessionStatus,
  upsertSession,
  type Session,
} from "@/domain/session/session";
import { parseSessionsFile, serializeSessionsFile } from "@/domain/session/sessions-file";

function demoPreset(index: number): Preset {
  const preset = demoPresets[index];
  if (!preset) throw new Error(`Aucun preset de démonstration à l'index ${index}`);
  return structuredClone(preset);
}

/** Ids déterministes : 00000000-0000-4000-8000-000000000001, …002 */
function sequentialIds() {
  let next = 0;
  return () => `00000000-0000-4000-8000-${String(++next).padStart(12, "0")}`;
}

async function launchedSession(preset: Preset, values?: Record<string, string>) {
  const fake = createFakeSystem();
  const engine = createLaunchEngine(fake.system, {
    newId: sequentialIds(),
    now: () => new Date("2026-09-30T08:00:00.000Z"),
  });
  await engine.launchPreset(preset, { values });
  const run = engine.getRuns()[preset.id];
  if (!run) throw new Error("lancement introuvable");
  return { fake, engine, run, session: sessionFromRun(run) };
}

describe("sessionFromRun", () => {
  it("fait d'un lancement complet un instantané : nom, valeurs, items tels que lancés, statuts", async () => {
    const nextjs = demoPreset(3);
    const { session } = await launchedSession(nextjs, { project: "blog", project_path: "C:/Projects/blog", port: "5173" });

    expect(session).toMatchObject({
      id: "00000000-0000-4000-8000-000000000001",
      presetId: nextjs.id,
      presetName: "Next.js project",
      presetIcon: "🚀",
      startedAt: "2026-09-30T08:00:00.000Z",
      finishedAt: "2026-09-30T08:00:00.000Z",
      values: { project: "blog", project_path: "C:/Projects/blog", port: "5173" },
      interrupted: false,
    });
    expect(session?.items.map((entry) => entry.status)).toEqual(["success", "running", "success"]);
    // Variables remplacées : la session dit ce qui a VRAIMENT été lancé.
    expect(session?.items[2]?.item).toMatchObject({ config: { url: "http://localhost:5173" } });
  });

  it("ne crée pas de session pour un item lancé seul", async () => {
    const devSaas = demoPreset(0);
    const engine = createLaunchEngine(createFakeSystem().system);
    await engine.launchItem(devSaas, devSaas.items[4]?.id ?? "");
    const run = engine.getRuns()[devSaas.id];
    expect(run && sessionFromRun(run)).toBeUndefined();
  });

  it("produit une session valide, relue à l'identique depuis le fichier", async () => {
    const { session } = await launchedSession(demoPreset(0));
    if (!session) throw new Error("session attendue");
    const reread = parseSessionsFile(serializeSessionsFile([session]));
    // La commande était « en cours » : relue, elle est considérée comme interrompue.
    expect(reread).toEqual({ ok: true, sessions: [markInterrupted(session)], ignored: 0 });
  });
});

describe("statut d'une session", () => {
  const base = (statuses: Session["items"][number]["status"][], interrupted = false): Session => ({
    id: "00000000-0000-4000-8000-000000000001",
    presetId: "00000000-0000-4000-8000-000000000002",
    presetName: "Test",
    startedAt: "2026-09-30T08:00:00.000Z",
    values: {},
    interrupted,
    items: statuses.map((status, index) => ({
      item: {
        id: `00000000-0000-4000-8000-00000000010${index}`,
        type: "url",
        name: `Item ${index}`,
        enabled: true,
        config: { url: "https://example.com" },
      },
      status,
    })),
  });

  it.each([
    [["success", "success"], true, "completed"],
    [["success", "failed"], false, "completed-with-errors"],
    [["success", "running"], true, "running"],
    [["success", "running"], false, "ended"],
    [["success", "skipped"], false, "completed"],
  ] as const)("%j (live: %s) → %s", (statuses, live, expected) => {
    expect(sessionStatus(base([...statuses]), live)).toBe(expected);
  });

  it("une session interrompue est « terminée », avec ses commandes arrêtées et ses items en attente ignorés", () => {
    const interrupted = markInterrupted(base(["success", "running", "pending"]));
    expect(interrupted.interrupted).toBe(true);
    expect(interrupted.items.map((entry) => entry.status)).toEqual(["success", "stopped", "skipped"]);
    expect(sessionStatus(interrupted, false)).toBe("ended");
  });
});

describe("historique", () => {
  const session = (id: number, startedAt: string, presetId = "00000000-0000-4000-8000-00000000000a"): Session => ({
    id: `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
    presetId,
    presetName: "Test",
    startedAt,
    values: { port: String(3000 + id) },
    items: [],
    interrupted: false,
  });

  it("ajoute ou met à jour, les plus récentes d'abord, dans la limite du plafond", () => {
    let sessions = [session(1, "2026-09-30T08:00:00.000Z"), session(2, "2026-09-30T09:00:00.000Z")];
    sessions = upsertSession(sessions, session(3, "2026-09-30T10:00:00.000Z"), 2);
    expect(sessions.map((entry) => entry.id.slice(-1))).toEqual(["3", "2"]);

    sessions = upsertSession(sessions, { ...session(2, "2026-09-30T09:00:00.000Z"), presetName: "Renamed" }, 2);
    expect(sessions.map((entry) => entry.presetName)).toEqual(["Test", "Renamed"]);
  });

  it("retrouve les valeurs du dernier lancement d'un preset", () => {
    const sessions = [session(2, "2026-09-30T09:00:00.000Z"), session(1, "2026-09-30T08:00:00.000Z")];
    expect(latestValues(sessions, "00000000-0000-4000-8000-00000000000a")).toEqual({ port: "3002" });
    expect(latestValues(sessions, "00000000-0000-4000-8000-00000000000b")).toBeUndefined();
  });
});

describe("parseSessionsFile", () => {
  it("écarte une session illisible et garde les autres", () => {
    const valid = {
      id: "00000000-0000-4000-8000-000000000001",
      presetId: "00000000-0000-4000-8000-000000000002",
      presetName: "Test",
      startedAt: "2026-09-30T08:00:00.000Z",
      values: {},
      items: [],
      interrupted: false,
    };
    const result = parseSessionsFile(JSON.stringify({ schemaVersion: 1, sessions: [valid, { broken: true }] }));
    expect(result).toEqual({ ok: true, sessions: [valid], ignored: 1 });
  });

  it("signale un fichier illisible ou d'une version plus récente", () => {
    expect(parseSessionsFile("{ oops")).toMatchObject({ ok: false, error: { kind: "invalid-file" } });
    expect(parseSessionsFile('{ "schemaVersion": 9, "sessions": [] }')).toEqual({
      ok: false,
      error: { kind: "unsupported-version", found: 9 },
    });
  });
});
