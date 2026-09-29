import { z } from "zod";
import { MAX_SESSIONS, SessionSchema, markInterrupted, type Session } from "@/domain/session/session";

/**
 * Fichier de l'historique (`sessions.json`), séparé de celui des presets : ils
 * n'ont pas la même valeur. Un historique abîmé ne doit jamais bloquer les
 * presets, et on peut se permettre d'être tolérant avec lui.
 */

export const SESSIONS_SCHEMA_VERSION = 1;

/** Enveloppe lue sans présumer du contenu des sessions, validées une par une. */
const EnvelopeSchema = z.object({
  schemaVersion: z.number().int().positive(),
  sessions: z.array(z.unknown()),
});

export type ParseSessionsResult =
  /** `ignored` : nombre de sessions illisibles écartées. */
  | { ok: true; sessions: Session[]; ignored: number }
  | { ok: false; error: { kind: "invalid-file"; message: string } | { kind: "unsupported-version"; found: number } };

export function parseSessionsFile(raw: string): ParseSessionsResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    return { ok: false, error: { kind: "invalid-file", message: error instanceof Error ? error.message : String(error) } };
  }

  const envelope = EnvelopeSchema.safeParse(data);
  if (!envelope.success) {
    return { ok: false, error: { kind: "invalid-file", message: "Not a sessions file" } };
  }
  if (envelope.data.schemaVersion !== SESSIONS_SCHEMA_VERSION) {
    return { ok: false, error: { kind: "unsupported-version", found: envelope.data.schemaVersion } };
  }

  // Tolérance : une session illisible est écartée, les autres sont gardées.
  const sessions: Session[] = [];
  for (const candidate of envelope.data.sessions) {
    const parsed = SessionSchema.safeParse(candidate);
    if (parsed.success) sessions.push(markInterrupted(parsed.data));
  }
  sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return {
    ok: true,
    sessions: sessions.slice(0, MAX_SESSIONS),
    ignored: envelope.data.sessions.length - sessions.length,
  };
}

export function serializeSessionsFile(sessions: readonly Session[]): string {
  return `${JSON.stringify({ schemaVersion: SESSIONS_SCHEMA_VERSION, sessions }, null, 2)}\n`;
}
