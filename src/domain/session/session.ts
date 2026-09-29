import { z } from "zod";
import type { LaunchRun } from "@/domain/launch/engine";
import type { ItemRunStatus } from "@/domain/launch/item-run";
import { StoredPresetItemSchema } from "@/domain/preset/schema";

/**
 * Session : le lancement d'un preset, enregistré dans l'historique.
 *
 * C'est un instantané : nom du preset, items tels que lancés (variables
 * remplacées), valeurs utilisées, résultat de chaque item. Il reste exact même
 * si le preset est modifié ou supprimé ensuite, et contient tout ce qu'il
 * faudrait pour rejouer ce lancement.
 */

const ITEM_RUN_STATUSES = ["pending", "running", "success", "failed", "skipped", "stopped"] as const satisfies readonly ItemRunStatus[];

export const SessionItemSchema = z.object({
  /** L'item tel qu'il a été lancé (variables remplacées). */
  item: StoredPresetItemSchema,
  status: z.enum(ITEM_RUN_STATUSES),
  error: z.string().max(2000).optional(),
  exitCode: z.number().int().nullable().optional(),
});

export const SessionSchema = z.object({
  id: z.uuid(),
  presetId: z.uuid(),
  presetName: z.string().max(200),
  presetIcon: z.string().max(16).optional(),
  startedAt: z.iso.datetime(),
  /** Fin de la séquence de lancement (les commandes ont pu continuer ensuite). */
  finishedAt: z.iso.datetime().optional(),
  values: z.record(z.string(), z.string()),
  items: z.array(SessionItemSchema),
  /** Vrai si l'application s'est fermée pendant la session, en arrêtant ses commandes. */
  interrupted: z.boolean(),
});

export type SessionItem = z.infer<typeof SessionItemSchema>;
export type Session = z.infer<typeof SessionSchema>;

/** Nombre de sessions conservées : les plus anciennes sont oubliées. */
export const MAX_SESSIONS = 200;

/** Session correspondant à un lancement complet ; `undefined` pour un item lancé seul. */
export function sessionFromRun(run: LaunchRun): Session | undefined {
  const launched = run.session;
  if (!launched) return undefined;
  return {
    id: launched.id,
    presetId: run.presetId,
    presetName: launched.presetName,
    ...(launched.presetIcon === undefined ? {} : { presetIcon: launched.presetIcon }),
    startedAt: run.startedAt,
    ...(run.finishedAt === undefined ? {} : { finishedAt: run.finishedAt }),
    values: run.values,
    items: launched.items.map((item): SessionItem => {
      const itemRun = run.items[item.id];
      return {
        item,
        status: itemRun?.status ?? "pending",
        ...(itemRun?.error === undefined ? {} : { error: itemRun.error }),
        ...(itemRun?.exitCode === undefined ? {} : { exitCode: itemRun.exitCode }),
      };
    }),
    interrupted: false,
  };
}

const isActive = (item: SessionItem) => item.status === "running" || item.status === "pending";

/**
 * Une session enregistrée avec des items « en cours » vient d'une application
 * fermée ou plantée pendant qu'elle tournait : ses commandes sont mortes avec
 * elle (voir `RunEvent::Exit` côté Rust). On l'indique au lieu de la laisser
 * « en cours » pour toujours.
 */
export function markInterrupted(session: Session): Session {
  if (!session.items.some(isActive)) return session;
  return {
    ...session,
    interrupted: true,
    items: session.items.map((item) =>
      item.status === "running"
        ? { ...item, status: "stopped" }
        : item.status === "pending"
          ? { ...item, status: "skipped" }
          : item,
    ),
  };
}

export type SessionStatus = "running" | "completed" | "completed-with-errors" | "ended";

/**
 * Statut affiché. `live` : la session est celle du lancement en cours de ce
 * preset. Une session plus ancienne qui a encore des items « en cours » a été
 * remplacée par un nouveau lancement (qui suit désormais ses commandes).
 */
export function sessionStatus(session: Session, live: boolean): SessionStatus {
  if (session.items.some(isActive)) return live ? "running" : "ended";
  if (session.interrupted) return "ended";
  return session.items.some((item) => item.status === "failed") ? "completed-with-errors" : "completed";
}

/** Ajoute ou met à jour une session ; les plus récentes d'abord, dans la limite du plafond. */
export function upsertSession(sessions: readonly Session[], session: Session, max: number = MAX_SESSIONS): Session[] {
  const others = sessions.filter((existing) => existing.id !== session.id);
  return [session, ...others].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, max);
}

/** Valeurs des variables du dernier lancement de ce preset (pré-remplissage). */
export function latestValues(sessions: readonly Session[], presetId: string): Record<string, string> | undefined {
  return sessions.find((session) => session.presetId === presetId)?.values;
}
