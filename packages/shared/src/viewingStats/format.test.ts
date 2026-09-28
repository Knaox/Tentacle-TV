import { describe, expect, it } from "vitest";
import {
  watchTimeParts,
  formatWatchTime,
  formatStatNumber,
  formatStatPercent,
  heroFigure,
  parseDateKey,
  statsLocale,
  weekdayOfDateKey,
} from "./format";
import { deviceTimeZone } from "./timeZone";

const NNBSP = " ";

describe("les nombres", () => {
  it("groupent les milliers à la française et à l'anglaise", () => {
    expect(formatStatNumber(1284, "fr")).toBe(`1${NNBSP}284`);
    expect(formatStatNumber(1284, "en")).toBe("1,284");
    expect(formatStatNumber(1234567, "en")).toBe("1,234,567");
    expect(formatStatNumber(2.5, "fr", 1)).toBe("2,5");
    expect(formatStatNumber(2.5, "en", 1)).toBe("2.5");
    expect(formatStatNumber(12, "fr")).toBe("12");
  });

  it("disent les parts en pour cent, sans jamais écrire 0 % pour une part réelle", () => {
    expect(formatStatPercent(0.324, "fr")).toBe(`32${NNBSP}%`);
    expect(formatStatPercent(0.324, "en")).toBe("32%");
    expect(formatStatPercent(0.004, "fr")).toBe(`< 1${NNBSP}%`);
    expect(formatStatPercent(0, "en")).toBe("0%");
  });

  it("reconnaissent la langue française sous toutes ses formes", () => {
    expect(statsLocale("fr-CA")).toBe("fr");
    expect(statsLocale("en-US")).toBe("en");
    expect(statsLocale(undefined)).toBe("en");
  });
});

describe("les durées", () => {
  it("se lisent d'un coup d'œil, jamais en secondes", () => {
    expect(formatWatchTime(0, "fr")).toBe("0 min");
    expect(formatWatchTime(30, "fr")).toBe("< 1 min");
    expect(formatWatchTime(45 * 60, "fr")).toBe("45 min");
    expect(formatWatchTime(3 * 3600, "fr")).toBe("3 h");
    expect(formatWatchTime(3 * 3600 + 5 * 60, "fr")).toBe("3 h 05");
    expect(formatWatchTime(3 * 3600 + 5 * 60, "en")).toBe("3 h 5 min");
    expect(formatWatchTime(52 * 3600, "fr")).toBe("2 j 4 h");
    expect(formatWatchTime(48 * 3600, "en")).toBe("2 d");
  });

  it("se décomposent en jours, heures et minutes", () => {
    expect(watchTimeParts(90061)).toEqual({ days: 1, hours: 1, minutes: 1 });
  });

  it("donnent au héros des heures dès qu'il y en a une, des minutes sinon", () => {
    expect(heroFigure(128.9 * 3600, "fr")).toEqual({ value: "128", unit: "hours", count: 2 });
    expect(heroFigure(2.56 * 3600, "fr")).toEqual({ value: "2,5", unit: "hours", count: 2 });
    expect(heroFigure(3 * 3600, "en")).toEqual({ value: "3", unit: "hours", count: 2 });
    expect(heroFigure(42 * 60, "en")).toEqual({ value: "42", unit: "minutes", count: 2 });
    expect(heroFigure(1500 * 3600, "fr").value).toBe(`1${NNBSP}500`);
  });

  it("tranchent le pluriel pareil partout — Hermes n'a pas Intl.PluralRules", () => {
    // Français : singulier sous 2 (« 1,7 heure », « 0 minute »).
    expect(heroFigure(1.75 * 3600, "fr").count).toBe(1);
    expect(heroFigure(0, "fr")).toEqual({ value: "0", unit: "minutes", count: 1 });
    // Anglais : singulier à 1 pile seulement (« 1.7 hours », « 1 hour »).
    expect(heroFigure(1.75 * 3600, "en").count).toBe(2);
    expect(heroFigure(3600, "en").count).toBe(1);
  });
});

describe("les dates locales", () => {
  it("se décomposent sans fuseau", () => {
    expect(parseDateKey("2026-09-26")).toEqual({ year: 2026, month: 8, day: 26 });
    expect(parseDateKey("2026-09")).toEqual({ year: 2026, month: 8, day: null });
    expect(parseDateKey("2026")).toEqual({ year: 2026, month: null, day: null });
  });

  it("donnent le jour de semaine, lundi en premier", () => {
    expect(weekdayOfDateKey("2026-09-28")).toBe(0);
    expect(weekdayOfDateKey("2026-09-27")).toBe(6);
  });
});

describe("le fuseau de l'appareil", () => {
  it("rend un nom IANA quand Intl le connaît", () => {
    expect(deviceTimeZone()).toMatch(/^[A-Za-z_]+(\/[A-Za-z_+-]+)*$|^UTC$|^Etc\/GMT[+-]\d+$/);
  });
});
