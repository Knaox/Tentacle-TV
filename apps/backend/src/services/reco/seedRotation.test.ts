import { describe, expect, it } from "vitest";
import { pickDaily } from "./seedRotation";

const ENTRIES = [
  { key: "movie:1", strength: 1.0 },
  { key: "movie:2", strength: 0.9 },
  { key: "movie:3", strength: 0.8 },
  { key: "tv:4", strength: 0.7 },
  { key: "tv:5", strength: 0.6 },
  { key: "movie:6", strength: 0.5 },
];

describe("rotation quotidienne des graines", () => {
  it("déterministe : même compte, même jour → même tirage", () => {
    const a = pickDaily(ENTRIES, "user-1", 3, "2026-09-01");
    const b = pickDaily(ENTRIES, "user-1", 3, "2026-09-01");
    expect(a).toEqual(b);
  });

  it("le tirage varie d'un jour à l'autre (au moins deux sélections sur dix jours)", () => {
    const seen = new Set<string>();
    for (let day = 1; day <= 10; day++) {
      const stamp = `2026-09-${String(day).padStart(2, "0")}`;
      seen.add(
        pickDaily(ENTRIES, "user-1", 3, stamp)
          .map((e) => e.key)
          .join(",")
      );
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("deux comptes ne voient pas la même rotation", () => {
    const days = Array.from({ length: 5 }, (_, i) => `2026-09-0${i + 1}`);
    const differs = days.some(
      (d) =>
        pickDaily(ENTRIES, "user-1", 3, d)
          .map((e) => e.key)
          .join(",") !==
        pickDaily(ENTRIES, "user-2", 3, d)
          .map((e) => e.key)
          .join(",")
    );
    expect(differs).toBe(true);
  });

  it("moins d'entrées que demandé : tout est rendu, sans remise", () => {
    const picked = pickDaily(ENTRIES.slice(0, 2), "user-1", 3, "2026-09-01");
    expect(picked).toHaveLength(2);
    expect(new Set(picked.map((e) => e.key)).size).toBe(2);
  });

  it("jamais de doublon dans un tirage", () => {
    const picked = pickDaily(ENTRIES, "user-1", 5, "2026-09-03");
    expect(new Set(picked.map((e) => e.key)).size).toBe(picked.length);
  });
});
