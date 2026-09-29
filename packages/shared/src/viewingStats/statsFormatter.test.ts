import { describe, expect, it } from "vitest";
import frStats from "../i18n/locales/fr/stats";
import enStats from "../i18n/locales/en/stats";
import { createStatsFormatter, type StatsTranslate } from "./statsFormatter";

/** Une traduction minimale : la table de l'espace `stats`, interpolation {{x}} comprise. */
function translate(table: Record<string, string>): StatsTranslate {
  return (key, options = {}) =>
    (table[key] ?? key).replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(options[name] ?? ""));
}

describe("createStatsFormatter", () => {
  const fr = createStatsFormatter(translate(frStats), "fr");
  const en = createStatsFormatter(translate(enStats), "en");

  it("écrit les jours à la française et à l'anglaise", () => {
    expect(fr.day("2026-09-26")).toBe("26 sept.");
    expect(fr.day("2026-09-26", true)).toBe("26 sept. 2026");
    expect(en.day("2026-09-26")).toBe("Sep 26");
    expect(en.day("2026-09-26", true)).toBe("Sep 26, 2026");
  });

  it("nomme les pas de la frise, sur l'axe et en entier", () => {
    expect(fr.tick("day", "2026-09-26")).toBe("26");
    expect(fr.tick("month", "2026-09")).toBe("sept.");
    expect(fr.tick("year", "2026")).toBe("2026");
    expect(fr.bucket("day", "2026-09-26")).toBe("samedi 26 sept.");
    expect(fr.bucket("month", "2026-09")).toBe("septembre 2026");
    expect(en.bucket("day", "2026-09-28")).toBe("Monday Sep 28");
  });

  it("dit une date au mois en mois, année comprise — les records d'une page partagée", () => {
    expect(fr.day("2026-03")).toBe("mars 2026");
    expect(fr.day("2026-03", true)).toBe("mars 2026");
    expect(en.day("2026-03")).toBe("March 2026");
  });

  it("dit un instant au jour local de l'appareil", () => {
    const local = new Date(2026, 8, 26, 23, 30);
    expect(fr.isoDay(local.toISOString())).toBe("26 sept.");
  });
});
