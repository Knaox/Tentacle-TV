import { describe, expect, it } from "vitest";
import {
  GUEST_PARENTAL_NONE,
  GUEST_SCHEDULE_NEVER,
  effectiveGuestParental,
  intersectSchedules,
  type GuestParentalCeiling,
} from "./familyParental";

const OPEN: GuestParentalCeiling = { ...GUEST_PARENTAL_NONE, allowedTags: [] };

describe("le contrôle parental d'un invité : jamais plus large que son créateur", () => {
  it("sans rien de part et d'autre : rien", () => {
    expect(effectiveGuestParental(OPEN, GUEST_PARENTAL_NONE)).toEqual(OPEN);
  });

  it("la note la plus basse l'emporte, d'où qu'elle vienne", () => {
    expect(effectiveGuestParental({ ...OPEN, maxParentalRating: 16 }, { ...GUEST_PARENTAL_NONE, maxParentalRating: 12 }).maxParentalRating).toBe(12);
    expect(effectiveGuestParental({ ...OPEN, maxParentalRating: 10 }, { ...GUEST_PARENTAL_NONE, maxParentalRating: 12 }).maxParentalRating).toBe(10);
    expect(effectiveGuestParental({ ...OPEN, maxParentalRating: 10 }, GUEST_PARENTAL_NONE).maxParentalRating).toBe(10);
  });

  it("à note égale, la sous-note la plus basse ; une sous-note absente ne relâche rien", () => {
    const result = effectiveGuestParental(
      { ...OPEN, maxParentalRating: 12, maxParentalSubRating: null },
      { ...GUEST_PARENTAL_NONE, maxParentalRating: 12, maxParentalSubRating: 0 },
    );
    expect([result.maxParentalRating, result.maxParentalSubRating]).toEqual([12, 0]);
    const lower = effectiveGuestParental(
      { ...OPEN, maxParentalRating: 10, maxParentalSubRating: 1 },
      { ...GUEST_PARENTAL_NONE, maxParentalRating: 12, maxParentalSubRating: 0 },
    );
    expect([lower.maxParentalRating, lower.maxParentalSubRating]).toEqual([10, 1]);
  });

  it("types non classés et étiquettes bloquées réunis ; étiquettes permises du créateur imposées", () => {
    const result = effectiveGuestParental(
      { ...OPEN, blockUnratedItems: ["Movie"], blockedTags: ["Gore"], allowedTags: ["famille"] },
      { ...GUEST_PARENTAL_NONE, blockUnratedItems: ["Series", "Movie"], blockedTags: ["gore", "horreur"] },
    );
    expect(result.blockUnratedItems).toEqual(["Movie", "Series"]);
    expect(result.blockedTags).toEqual(["Gore", "horreur"]);
    expect(result.allowedTags).toEqual(["famille"]);
  });
});

describe("intersectSchedules", () => {
  it("aucune plage d'un côté : celles de l'autre", () => {
    const weekend = [{ dayOfWeek: "Weekend" as const, startHour: 9, endHour: 20 }];
    expect(intersectSchedules([], weekend)).toEqual(weekend);
    expect(intersectSchedules(weekend, [])).toEqual(weekend);
    expect(intersectSchedules([], [])).toEqual([]);
  });

  it("recoupe jour par jour, heures décimales comprises", () => {
    const result = intersectSchedules(
      [{ dayOfWeek: "Everyday", startHour: 8, endHour: 21.5 }],
      [{ dayOfWeek: "Weekend", startHour: 10, endHour: 23 }],
    );
    expect(result).toEqual([
      { dayOfWeek: "Sunday", startHour: 10, endHour: 21.5 },
      { dayOfWeek: "Saturday", startHour: 10, endHour: 21.5 },
    ]);
  });

  it("aucun recoupement : JAMAIS, pas « à toute heure »", () => {
    const result = intersectSchedules(
      [{ dayOfWeek: "Weekday", startHour: 8, endHour: 12 }],
      [{ dayOfWeek: "Weekend", startHour: 8, endHour: 12 }],
    );
    expect(result).toEqual(GUEST_SCHEDULE_NEVER);
    expect(result.length).toBeGreaterThan(0);
  });
});
