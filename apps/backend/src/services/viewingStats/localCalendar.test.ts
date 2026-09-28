import { describe, expect, it } from "vitest";
import { LocalCalendar, monthSpan, resolveTimeZone, shiftDay, shiftMonth } from "./localCalendar";

describe("resolveTimeZone", () => {
  it("garde un fuseau IANA connu", () => {
    expect(resolveTimeZone("Europe/Paris")).toBe("Europe/Paris");
  });

  it("retombe sur UTC pour un fuseau absent ou inventé", () => {
    expect(resolveTimeZone(undefined)).toBe("UTC");
    expect(resolveTimeZone("")).toBe("UTC");
    expect(resolveTimeZone("Nulle/Part")).toBe("UTC");
  });
});

describe("LocalCalendar", () => {
  it("donne le jour, l'heure et le jour de semaine LOCAUX (Paris, heure d'été)", () => {
    const cal = new LocalCalendar("Europe/Paris");
    // 28/09/2026 21:30 UTC = 23:30 à Paris, un lundi.
    const p = cal.parts(Date.parse("2026-09-28T21:30:00Z"));
    expect(p).toEqual({ day: "2026-09-28", month: "2026-09", year: 2026, weekday: 0, hour: 23 });
  });

  it("change de jour au bon moment (Paris, minuit local)", () => {
    const cal = new LocalCalendar("Europe/Paris");
    expect(cal.parts(Date.parse("2026-09-28T22:10:00Z")).day).toBe("2026-09-29");
  });

  it("suit le passage à l'heure d'été (29/03/2026)", () => {
    const cal = new LocalCalendar("Europe/Paris");
    // 00:30 UTC = 01:30 CET ; 01:30 UTC = 03:30 CEST — 02 h n'existe pas.
    expect(cal.parts(Date.parse("2026-03-29T00:30:00Z")).hour).toBe(1);
    expect(cal.parts(Date.parse("2026-03-29T01:30:00Z")).hour).toBe(3);
    expect(cal.parts(Date.parse("2026-03-29T01:30:00Z")).weekday).toBe(6);
  });

  it("tient les fuseaux à la demi-heure (Calcutta, +5 h 30)", () => {
    const cal = new LocalCalendar("Asia/Kolkata");
    const p = cal.parts(Date.parse("2026-09-28T18:40:00Z"));
    expect(p.day).toBe("2026-09-29");
    expect(p.hour).toBe(0);
    // 18:29 UTC = 23:59 locale : encore le 28.
    expect(cal.parts(Date.parse("2026-09-28T18:29:00Z")).day).toBe("2026-09-28");
  });
});

describe("arithmétique des dates locales", () => {
  it("décale les jours à travers mois et années", () => {
    expect(shiftDay("2026-09-30", 1)).toBe("2026-10-01");
    expect(shiftDay("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftDay("2026-09-28", -29)).toBe("2026-08-30");
  });

  it("décale les mois et compte leur étendue", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(monthSpan("2026-01", "2026-03")).toBe(3);
    expect(monthSpan("2024-10", "2026-09")).toBe(24);
  });
});
