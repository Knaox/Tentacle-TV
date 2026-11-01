import { describe, expect, it } from "vitest";
import type { Anchor } from "./anchors";
import { pickSeeds } from "./seedPicker";

const NOW = Date.parse("2026-11-01T12:00:00Z");
const DAY = 86_400_000;

const anchor = (key: string, over: Partial<Anchor> = {}): Anchor => {
  const [type, id] = key.split(":");
  return {
    key, mediaType: type === "movie" ? "movie" : "tv", tmdbId: Number(id), title: key, weight: 1,
    consumption: true, hours: 2, lastAt: null, kinds: ["completed"], ...over,
  };
};
/** Facettes toutes distinctes : aucune graine ne fait doublon. */
const distinct = (a: Anchor) => [{ key: `kw:${a.key}`, mult: 1 }];
const keysOf = (seeds: ReturnType<typeof pickSeeds>) => seeds.map((s) => `${s.mediaType}:${s.tmdbId}`);

describe("graines : quota au nombre de titres", () => {
  it("cent cinquante films et vingt séries très regardées : les films gardent la majorité", () => {
    const films = Array.from({ length: 150 }, (_, i) => anchor(`movie:${i + 1}`, { weight: 0.7 }));
    const shows = Array.from({ length: 20 }, (_, i) => anchor(`tv:${i + 1}`, { weight: 1.1, hours: 100, kinds: ["series"] }));
    const seeds = pickSeeds([...shows, ...films], distinct, { now: NOW, userId: "u" });
    const movies = seeds.filter((s) => s.mediaType === "movie").length;
    expect(seeds).toHaveLength(30);
    expect(movies).toBeGreaterThanOrEqual(30 * 0.75 - 1);
  });

  it("un type trop pauvre cède ses places à l'autre", () => {
    const films = Array.from({ length: 40 }, (_, i) => anchor(`movie:${i + 1}`));
    const seeds = pickSeeds([...films, anchor("tv:1", { kinds: ["series"] })], distinct, { now: NOW, userId: "u" });
    expect(seeds).toHaveLength(30);
    expect(keysOf(seeds)).toContain("tv:1");
  });
});

describe("graines : égalités et rotation", () => {
  // Quatre-vingts titres au plafond, sans date : rien ne les départage que le jour.
  const ties = Array.from({ length: 80 }, (_, i) => anchor(`movie:${i + 1}`, { weight: 2.5 }));

  it("à force égale, le plus récent, puis le plus regardé, puis le noté passent devant", () => {
    const set = [
      anchor("movie:1", { weight: 1 }),
      anchor("movie:2", { weight: 1, hours: 3 }),
      anchor("movie:3", { weight: 1, kinds: ["completed", "rating"] }),
      anchor("movie:4", { weight: 1, lastAt: new Date(NOW - 200 * DAY).toISOString() }),
    ];
    const seeds = pickSeeds(set, distinct, { now: NOW, userId: "u", max: 4 });
    expect(keysOf(seeds)).toEqual(["movie:4", "movie:2", "movie:3", "movie:1"]);
  });

  it("des égaux ne sont jamais rangés par identifiant TMDB", () => {
    const seeds = pickSeeds(ties, distinct, { now: NOW, userId: "u", dayStamp: "2026-11-01" });
    const ids = seeds.map((s) => s.tmdbId);
    expect(ids).not.toEqual(ids.slice().sort((a, b) => a - b));
    expect(Math.max(...ids)).toBeGreaterThan(30);
  });

  it("déterministe pour un compte et un jour ; un autre jour, un autre tirage", () => {
    const at = (dayStamp: string, userId = "u") => keysOf(pickSeeds(ties, distinct, { now: NOW, userId, dayStamp }));
    expect(at("2026-11-01")).toEqual(at("2026-11-01"));
    expect(new Set(at("2026-11-01"))).not.toEqual(new Set(at("2026-11-02")));
    expect(new Set(at("2026-11-01"))).not.toEqual(new Set(at("2026-11-01", "v")));
  });

  it("les plus fortes restent tous les jours ; le reste tourne dans un vivier plus large", () => {
    const ranked = Array.from({ length: 80 }, (_, i) => anchor(`movie:${i + 1}`, { weight: 2.4 - i * 0.02 }));
    const top = ranked.slice(0, 18).map((a) => a.key);
    const seen = new Set<string>();
    for (let d = 1; d <= 10; d++) {
      const keys = keysOf(pickSeeds(ranked, distinct, { now: NOW, userId: "u", max: 30, dayStamp: `2026-11-${String(d).padStart(2, "0")}` }));
      expect(keys).toHaveLength(30);
      for (const k of top) expect(keys).toContain(k);
      keys.forEach((k) => seen.add(k));
    }
    // Plus de trente titres vus sur dix jours, aucun au-delà du vivier (2 × 30).
    expect(seen.size).toBeGreaterThan(30);
    expect([...seen].every((k) => Number(k.split(":")[1]) <= 60)).toBe(true);
  });
});
