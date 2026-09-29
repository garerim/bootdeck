import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";

/** Forme des erreurs Rust (`AppError` sérialisée). */
const CommandErrorSchema = z.object({ kind: z.string(), message: z.string() });

/** Erreur renvoyée par une commande Rust. `kind` permet de réagir, `message` s'affiche. */
export class CommandError extends Error {
  constructor(
    readonly kind: string,
    message: string,
  ) {
    super(message);
    this.name = "CommandError";
  }
}

/**
 * Appelle une commande Rust et valide sa réponse avec `schema`.
 * La frontière IPC est traitée comme n'importe quelle entrée externe : on vérifie
 * ce qui revient au lieu de le « caster » vers le type attendu.
 */
export async function invokeCommand<T>(
  command: string,
  args: Record<string, unknown> | undefined,
  schema: z.ZodType<T>,
): Promise<T> {
  let response: unknown;
  try {
    response = await invoke(command, args);
  } catch (error) {
    const parsed = CommandErrorSchema.safeParse(error);
    throw parsed.success
      ? new CommandError(parsed.data.kind, parsed.data.message)
      : new CommandError("unknown", String(error));
  }
  return schema.parse(response);
}
