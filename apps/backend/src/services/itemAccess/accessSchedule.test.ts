/**
 * Les plages horaires d'un compte, à la manière de Jellyfin
 * (`User.IsParentalScheduleAllowed`) : aucune plage = permis ; sinon une plage
 * qui couvre l'instant, jour et heures décimales, à l'heure locale.
 */

import { describe, expect, it } from "vitest";
import { scheduleAllows } from "./accessSchedule";

/** Un instant à l'heure LOCALE : 2026-10-14 est un mercredi, 2026-10-17 un samedi. */
const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute);

describe("scheduleAllows", () => {
  it("aucune plage : toujours permis", () => {
    expect(scheduleAllows([], at(14, 3))).toBe(true);
  });

  it("une plage du jour : bornes comprises, heures décimales (20.5 = 20 h 30)", () => {
    const evenings = [{ dayOfWeek: "Wednesday" as const, startHour: 17, endHour: 20.5 }];
    expect(scheduleAllows(evenings, at(14, 17))).toBe(true);
    expect(scheduleAllows(evenings, at(14, 20, 30))).toBe(true);
    expect(scheduleAllows(evenings, at(14, 20, 31))).toBe(false);
    expect(scheduleAllows(evenings, at(14, 16, 59))).toBe(false);
    // Le bon créneau, un autre jour : refusé.
    expect(scheduleAllows(evenings, at(15, 18))).toBe(false);
  });

  it("Everyday, Weekday (lundi → vendredi), Weekend (samedi, dimanche)", () => {
    const day = (dayOfWeek: "Everyday" | "Weekday" | "Weekend") => [{ dayOfWeek, startHour: 0, endHour: 24 }];
    expect(scheduleAllows(day("Everyday"), at(17, 12))).toBe(true);
    expect(scheduleAllows(day("Weekday"), at(14, 12))).toBe(true);
    expect(scheduleAllows(day("Weekday"), at(17, 12))).toBe(false);
    expect(scheduleAllows(day("Weekend"), at(17, 12))).toBe(true);
    expect(scheduleAllows(day("Weekend"), at(14, 12))).toBe(false);
  });

  it("plusieurs plages : une seule qui couvre l'instant suffit", () => {
    const schedules = [
      { dayOfWeek: "Weekday" as const, startHour: 17, endHour: 19 },
      { dayOfWeek: "Weekend" as const, startHour: 9, endHour: 21 },
    ];
    expect(scheduleAllows(schedules, at(17, 10))).toBe(true);
    expect(scheduleAllows(schedules, at(14, 10))).toBe(false);
  });
});
