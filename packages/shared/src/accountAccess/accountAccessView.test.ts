import { describe, expect, it } from "vitest";
import { GUEST_SCHEDULE_NEVER } from "../family/familyParental";
import { accountAccessView, reopeningOf, scheduleLines } from "./accountAccessView";

/** La page d'un compte bloqué : les plages en clair, dans l'ordre, et le jour de réouverture. */
const PARIS = () => 120;
const at = (day: number, hour: number, minute = 0) => Date.UTC(2026, 9, day, hour - 2, minute);

describe("vue de la page d'accès", () => {
  it("les plages : groupes d'abord, puis lundi → dimanche, minutes ; « jamais » n'est pas une plage", () => {
    expect(
      scheduleLines([
        { dayOfWeek: "Sunday", startHour: 10, endHour: 12 },
        { dayOfWeek: "Weekday", startHour: 17.5, endHour: 24 },
        { dayOfWeek: "Monday", startHour: 8, endHour: 9 },
        ...GUEST_SCHEDULE_NEVER,
      ]),
    ).toEqual([
      { day: "Weekday", start: 1050, end: 1440 },
      { day: "Monday", start: 480, end: 540 },
      { day: "Sunday", start: 600, end: 720 },
    ]);
  });

  it("la réouverture : aujourd'hui, demain, plus tard, jamais, inconnue", () => {
    const now = at(15, 21);
    const outside = (nextOpening: number | null, schedules = [{ dayOfWeek: "Everyday" as const, startHour: 8, endHour: 22 }]) => ({
      state: "outsideSchedule" as const,
      schedules,
      nextOpening,
    });
    expect(reopeningOf(outside(at(15, 22)), now, PARIS)).toEqual({ kind: "today", at: at(15, 22) });
    expect(reopeningOf(outside(at(16, 8)), now, PARIS)).toEqual({ kind: "tomorrow", at: at(16, 8) });
    expect(reopeningOf(outside(at(19, 8)), now, PARIS)?.kind).toBe("later");
    expect(reopeningOf(outside(null), now, PARIS)).toEqual({ kind: "never" });
    expect(reopeningOf(outside(null, []), now, PARIS)).toEqual({ kind: "unknown" });
    expect(reopeningOf({ state: "disabled" }, now, PARIS)).toBeNull();
  });

  it("les variantes : désactivé, bloqué après trop d'essais, hors plage", () => {
    expect(accountAccessView({ state: "disabled" }, 0).variant).toBe("disabled");
    expect(accountAccessView({ state: "disabled", lockedOut: true }, 0)).toMatchObject({ variant: "lockedOut", titleKey: "lockedOut.title" });
    expect(accountAccessView({ state: "outsideSchedule", schedules: [], nextOpening: null }, 0).bodyKey).toBe("outsideSchedule.body");
  });
});
