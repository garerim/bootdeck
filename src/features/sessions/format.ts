import type { Session } from "@/domain/session/session";

export interface SessionGroup {
  /** Jour local, ex. `2026-09-30` : clé stable pour React. */
  key: string;
  label: string;
  sessions: Session[];
}

const dayFormat = new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" });

/** Jour local (et non UTC) : une session lancée à 00:30 appartient bien à « aujourd'hui ». */
function localDayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Regroupe les sessions (déjà triées, les plus récentes d'abord) par jour : Today, Yesterday, puis la date. */
export function groupSessionsByDay(sessions: readonly Session[], now: Date): SessionGroup[] {
  const today = localDayKey(now);
  const yesterday = localDayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));

  const groups: SessionGroup[] = [];
  for (const session of sessions) {
    const started = new Date(session.startedAt);
    const key = localDayKey(started);
    let group = groups[groups.length - 1];
    if (group?.key !== key) {
      const label = key === today ? "Today" : key === yesterday ? "Yesterday" : dayFormat.format(started);
      group = { key, label, sessions: [] };
      groups.push(group);
    }
    group.sessions.push(session);
  }
  return groups;
}
