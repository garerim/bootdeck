import { Channel } from "@tauri-apps/api/core";
import { z } from "zod";
import type { ProcessEvent, SystemAdapter } from "@/domain/launch/system-adapter";
import { invokeCommand } from "@/platform/tauri/invoke";

/** Forme des événements envoyés par Rust (`models::ProcessEvent`), revérifiée à la réception. */
const ProcessEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("stdout"), line: z.string() }),
  z.object({ type: z.literal("stderr"), line: z.string() }),
  z.object({ type: z.literal("exited"), code: z.number().int().nullable() }),
]) satisfies z.ZodType<ProcessEvent>;

/** Opérations système réelles, exécutées par Rust (`commands/launcher.rs`, `commands/processes.rs`). */
export const tauriSystemAdapter: SystemAdapter = {
  openUrl: async (url) => {
    await invokeCommand("open_url", { url }, z.null());
  },

  openFolder: async (path) => {
    await invokeCommand("open_folder", { path }, z.null());
  },

  launchApplication: async (request) => {
    await invokeCommand("launch_application", { request }, z.null());
  },

  executeCommand: (request, onEvent) => {
    // Un Channel Tauri est propre à cet appel et préserve l'ordre des messages.
    const channel = new Channel<unknown>((message) => {
      const event = ProcessEventSchema.safeParse(message);
      if (event.success) onEvent(event.data);
    });
    return invokeCommand("execute_command", { request, onEvent: channel }, z.number().int().nonnegative());
  },

  stopProcess: async (processId) => {
    await invokeCommand("stop_process", { processId }, z.null());
  },
};
