import { Channel } from "@tauri-apps/api/core";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import contractJson from "../../../contracts/ipc.json";
import type { ProcessEvent } from "@/domain/launch/system-adapter";
import { pickFolder, pickProgram } from "@/platform/dialogs";
import { CommandError } from "@/platform/tauri/invoke";
import { tauriFileStorage } from "@/platform/tauri/tauri-file-storage";
import { tauriSystemAdapter } from "@/platform/tauri/tauri-system-adapter";

/**
 * Intégration front ↔ Rust, côté front : chaque appel du contrat partagé
 * (`contracts/ipc.json`) doit être exactement ce qu'envoie l'adaptateur Tauri, et
 * la réponse convenue doit être comprise. Rust rejoue les mêmes appels de son côté
 * (`src-tauri/tests/ipc.rs`) : si l'un des deux change sans l'autre, un test échoue.
 */

const ContractSchema = z.object({
  calls: z.array(
    z.object({
      name: z.string(),
      command: z.string(),
      args: z.record(z.string(), z.unknown()),
      response: z.union([z.object({ ok: z.unknown() }), z.object({ error: z.string() })]),
    }),
  ),
  processEvents: z.array(z.unknown()),
});
const contract = ContractSchema.parse(contractJson);

/** L'action du front qui doit produire chaque appel du contrat. */
const FRONT_CALLS: Record<string, () => Promise<unknown>> = {
  "open_url refuses a URL that is not a web page": () => tauriSystemAdapter.openUrl("ftp://example.com/file"),
  "open_folder reports a missing folder": () => tauriSystemAdapter.openFolder("~/startdeck-contract/missing"),
  "launch_application reports a missing program": () =>
    tauriSystemAdapter.launchApplication({
      path: "~/startdeck-contract/tool.exe",
      args: ["--flag"],
      workingDirectory: "~",
    }),
  "execute_command starts a command and returns its process id": () =>
    tauriSystemAdapter.executeCommand({ command: "echo contract", workingDirectory: "~" }, () => {}),
  "execute_command reports a missing working directory": () =>
    tauriSystemAdapter.executeCommand(
      { command: "echo contract", workingDirectory: "~/startdeck-contract/missing" },
      () => {},
    ),
  "stop_process accepts a process that has already finished": () => tauriSystemAdapter.stopProcess(999999),
  "load_data_file returns the path and no content for a new file": () => tauriFileStorage("presets").read(),
  "save_data_file writes a versioned JSON document": () =>
    tauriFileStorage("sessions").write('{"schemaVersion":1,"sessions":[]}'),
  "backup_data_file reports a file that does not exist": () => tauriFileStorage("presets").backup(),
  "pick_folder opens the native dialog in the given folder": () => pickFolder("~/Projects"),
  "pick_program returns null when the user cancels": () => pickProgram(),
};

/** Arguments tels qu'ils partiront en JSON : Channel → "<channel>", champs `undefined` retirés. */
function asSent(value: unknown): unknown {
  if (value instanceof Channel) return "<channel>";
  if (Array.isArray(value)) return value.map(asSent);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, field]) => field !== undefined)
        .map(([key, field]) => [key, asSent(field)]),
    );
  }
  return value;
}

/** Réponse concrète pour les valeurs génériques du contrat ("<string>", "<number>"). */
function sample(value: unknown): unknown {
  if (value === "<string>") return "C:/Users/me/AppData/Roaming/presets.json";
  if (value === "<number>") return 7;
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, field]) => [key, sample(field)]));
  }
  return value;
}

interface TauriInternals {
  runCallback: (id: number, data: unknown) => void;
}

beforeEach(() => {
  // `mockIPC` remplace `window.__TAURI_INTERNALS__` ; sous Node, `window` est l'objet global.
  vi.stubGlobal("window", globalThis);
});

afterEach(() => {
  clearMocks();
  vi.unstubAllGlobals();
});

describe("contrat IPC — côté front", () => {
  it("chaque appel du contrat correspond à une action du front, et inversement", () => {
    expect(Object.keys(FRONT_CALLS).sort()).toEqual(contract.calls.map((call) => call.name).sort());
  });

  it.each(contract.calls.map((call) => [call.name, call] as const))("%s", async (_name, call) => {
    const sent: { command: string; args: unknown }[] = [];
    mockIPC((command, args) => {
      sent.push({ command, args: asSent(args) });
      // Rust répond une valeur, ou rejette avec une `AppError` sérialisée `{ kind, message }`.
      if ("error" in call.response) throw { kind: call.response.error, message: "Explained by Rust" };
      return sample(call.response.ok);
    });

    const frontCall = FRONT_CALLS[call.name];
    if (!frontCall) throw new Error(`no front-end call for "${call.name}"`);
    const outcome = frontCall();

    if ("error" in call.response) {
      await expect(outcome).rejects.toEqual(new CommandError(call.response.error, "Explained by Rust"));
    } else {
      // La réponse passe par le schéma Zod de l'adaptateur : une forme inattendue lèverait ici.
      await outcome;
    }
    expect(sent).toEqual([{ command: call.command, args: call.args }]);
  });

  it("comprend les événements de processus tels que Rust les envoie, dans l'ordre", async () => {
    let channel: Channel<unknown> | undefined;
    mockIPC((_command, args) => {
      const onEvent = (args as { onEvent?: unknown } | undefined)?.onEvent;
      if (onEvent instanceof Channel) channel = onEvent;
      return 1;
    });
    const received: ProcessEvent[] = [];
    await tauriSystemAdapter.executeCommand({ command: "npm run dev" }, (event) => received.push(event));
    if (!channel) throw new Error("the adapter did not send a Channel");

    // Messages numérotés : le Channel de Tauri rétablit l'ordre s'ils arrivent dans le désordre.
    const internals = (globalThis as unknown as { __TAURI_INTERNALS__: TauriInternals }).__TAURI_INTERNALS__;
    const messages = contract.processEvents.map((message, index) => ({ message, index }));
    for (const message of [...messages].reverse()) internals.runCallback(channel.id, message);

    expect(received).toEqual(contract.processEvents);
  });

  it("ignore un événement de forme inconnue au lieu de le transmettre au domaine", async () => {
    let channel: Channel<unknown> | undefined;
    mockIPC((_command, args) => {
      const onEvent = (args as { onEvent?: unknown } | undefined)?.onEvent;
      if (onEvent instanceof Channel) channel = onEvent;
      return 1;
    });
    const received: ProcessEvent[] = [];
    await tauriSystemAdapter.executeCommand({ command: "npm run dev" }, (event) => received.push(event));
    const internals = (globalThis as unknown as { __TAURI_INTERNALS__: TauriInternals }).__TAURI_INTERNALS__;
    internals.runCallback(channel?.id ?? -1, { message: { type: "exited", code: "zero" }, index: 0 });
    expect(received).toEqual([]);
  });

  it("transforme un refus de Tauri lui-même (permission, argument) en CommandError « unknown »", async () => {
    mockIPC(() => {
      throw "open_url not allowed. Permissions associated with this command: allow-open-url";
    });
    await expect(tauriSystemAdapter.openUrl("https://example.com")).rejects.toMatchObject({
      name: "CommandError",
      kind: "unknown",
      message: expect.stringContaining("not allowed"),
    });
  });
});
