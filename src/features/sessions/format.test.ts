import { describe, expect, it } from "vitest";
import type { Session } from "@/domain/session/session";
import { groupSessionsByDay } from "@/features/sessions/format";

function sessionAt(date: Date, id: number): Session {
  return {
    id: `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
    presetId: "00000000-0000-4000-8000-00000000000a",
    presetName: "Test",
    startedAt: date.toISOString(),
    values: {},
    items: [],
    interrupted: false,
  };
}

describe("groupSessionsByDay", () => {
  // Dates construites en heure LOCALE : le test passe quel que soit le fuseau de la machine.
  const now = new Date(2026, 8, 30, 10, 0);

  it("regroupe par jour local : Today, Yesterday, puis la date", () => {
    const sessions = [
      sessionAt(new Date(2026, 8, 30, 9, 0), 1),
      sessionAt(new Date(2026, 8, 30, 0, 30), 2),
      sessionAt(new Date(2026, 8, 29, 23, 59), 3),
      sessionAt(new Date(2026, 8, 27, 14, 0), 4),
    ];
    const groups = groupSessionsByDay(sessions, now);

    expect(groups.map((group) => [group.label, group.sessions.length])).toEqual([
      ["Today", 2],
      ["Yesterday", 1],
      ["Sun, Sep 27", 1],
    ]);
  });

  it("renvoie une liste vide sans session", () => {
    expect(groupSessionsByDay([], now)).toEqual([]);
  });
});
