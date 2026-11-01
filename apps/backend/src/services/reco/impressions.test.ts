import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it, vi } from "vitest";

// Un vrai SQLite en mémoire, schéma de la migration : l'upsert groupé y est rejoué tel quel.
const db = new DatabaseSync(":memory:");
db.exec(readFileSync(join(__dirname, "../../../prisma/migrations-sqlite/0020_reco_impressions.sql"), "utf8"));
vi.mock("../db", () => ({
  getPrisma: () => ({
    $executeRawUnsafe: async (sql: string, ...params: Array<string | number>) => Number(db.prepare(sql).run(...params).changes),
  }),
}));

import { epochDay, flushImpressions, impressionFatigue, isPersonalRow, noteServedRows, resetImpressionQueue } from "./impressions";

const rowOf = (key: string) =>
  db.prepare(`SELECT "daysShown", "firstDay", "lastDay" FROM "reco_impressions" WHERE "itemKey" = ?`).get(key) as
    | { daysShown: number; firstDay: number; lastDay: number }
    | undefined;
const serve = async (day: string, keys: string[], rowKey = "forYou") => {
  noteServedRows("compte-a", day, [{ key: rowKey, items: keys.map((key) => ({ key })) }]);
  await flushImpressions();
};

afterEach(() => resetImpressionQueue());

describe("lassitude d'un titre montré", () => {
  const today = epochDay("2026-11-20");

  it("intact les deux premiers jours, puis recule de plus en plus", () => {
    const after = (days: number) => impressionFatigue({ firstDay: today - days, lastDay: today - 1, daysShown: days }, today);
    expect(after(1)).toBe(1);
    expect(after(3)).toBeLessThan(after(2));
    expect(after(7)).toBeLessThan(0.4);
    expect(after(14)).toBeLessThan(0.1);
  });

  it("le jour même ne compte pas encore : la page d'aujourd'hui tire comme celle du matin", () => {
    const morning = impressionFatigue({ firstDay: today - 5, lastDay: today - 1, daysShown: 5 }, today);
    expect(impressionFatigue({ firstDay: today - 5, lastDay: today, daysShown: 6 }, today)).toBeCloseTo(morning, 1);
  });

  it("revient à mesure qu'il se repose, tout à fait après trente jours", () => {
    const rested = (idle: number) => impressionFatigue({ firstDay: today - idle - 10, lastDay: today - idle, daysShown: 10 }, today);
    expect(rested(15)).toBeGreaterThan(rested(1));
    expect(rested(30)).toBe(1);
  });

  it("seules les rangées tirées du pool comptent", () => {
    expect(isPersonalRow("forYou")).toBe(true);
    expect(isPersonalRow("becauseYouLiked:movie:1")).toBe(true);
    expect(isPersonalRow("trending")).toBe(false);
    expect(isPersonalRow("community")).toBe(false);
  });
});

describe("écriture groupée de l'affiché", () => {
  it("une fois par jour et par titre, quel que soit le nombre de requêtes", async () => {
    await serve("2026-11-01", ["movie:1", "movie:2"]);
    await serve("2026-11-01", ["movie:1"]);
    expect(rowOf("movie:1")).toEqual({ daysShown: 1, firstDay: epochDay("2026-11-01"), lastDay: epochDay("2026-11-01") });
    await serve("2026-11-02", ["movie:1"]);
    await serve("2026-11-03", ["movie:1"]);
    expect(rowOf("movie:1")?.daysShown).toBe(3);
    expect(rowOf("movie:2")?.daysShown).toBe(1);
  });

  it("une rangée globale n'écrit rien", async () => {
    await serve("2026-11-01", ["movie:50"], "trending");
    expect(rowOf("movie:50")).toBeUndefined();
  });

  it("un titre reposé trente jours repart d'un jour", async () => {
    await serve("2026-12-10", ["movie:2"]);
    expect(rowOf("movie:2")).toEqual({ daysShown: 1, firstDay: epochDay("2026-12-10"), lastDay: epochDay("2026-12-10") });
  });

  it("un lot plus grand que la borne de SQLite s'écrit en plusieurs instructions", async () => {
    const keys = Array.from({ length: 400 }, (_, i) => `tv:${i + 1}`);
    await serve("2026-11-05", keys);
    expect(Number((db.prepare(`SELECT COUNT(*) AS n FROM "reco_impressions" WHERE "itemKey" LIKE 'tv:%'`).get() as { n: number }).n)).toBe(400);
  });
});
