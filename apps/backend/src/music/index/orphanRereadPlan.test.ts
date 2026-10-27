import { describe, expect, it } from "vitest";
import { folderOf, nextAttempts, ORPHAN_REREAD_PER_PASS, ORPHAN_REREAD_RETRY_MS, parseAttempts, pickOrphans } from "./orphanRereadPlan";

const NOW = 1_800_000_000_000;

describe("quels titres sans album relire", () => {
  it("jamais essayés : les plus récents d'abord, au plus un passage", () => {
    const orphans = Array.from({ length: 40 }, (_, i) => `t${i}`);
    expect(pickOrphans(orphans, {}, NOW)).toEqual(orphans.slice(0, ORPHAN_REREAD_PER_PASS));
  });

  it("un titre relu sans résultat attend une semaine", () => {
    expect(pickOrphans(["a", "b"], { a: NOW - 3_600_000 }, NOW)).toEqual(["b"]);
    expect(pickOrphans(["a"], { a: NOW - ORPHAN_REREAD_RETRY_MS }, NOW)).toEqual(["a"]);
  });

  it("la mémoire oublie un titre qui a retrouvé son album, note ceux du passage", () => {
    expect(nextAttempts({ gone: 1, a: 2 }, ["a", "b"], ["b"], NOW)).toEqual({ a: 2, b: NOW });
  });

  it("une mémoire illisible vaut aucune", () => {
    expect(parseAttempts("pas du json")).toEqual({});
    expect(parseAttempts('{"a":1,"b":"x"}')).toEqual({ a: 1 });
    expect(parseAttempts(undefined)).toEqual({});
  });

  it("le dossier d'un fichier, Linux comme Windows", () => {
    expect(folderOf("/music/Tears for Fears/Songs From the Big Chair (1985)/01 Shout.flac")).toBe("/music/Tears for Fears/Songs From the Big Chair (1985)");
    expect(folderOf("D:\\Musique\\Album\\01.flac")).toBe("D:\\Musique\\Album");
    expect(folderOf("x.flac")).toBeNull();
  });
});
