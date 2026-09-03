import { describe, expect, it } from "vitest";
import { reconcileHomeRows } from "./homeLayout";

describe("réconciliation des rangées de l'accueil", () => {
  const libs = [{ id: "L1", name: "Films" }];

  it("une rangée reco née après la mise en page stockée s'ajoute en fin, éteinte", () => {
    const stored = [
      { key: "resume", enabled: true },
      { key: "reco:forYou", enabled: true },
      { key: "library:L1", enabled: true },
    ];
    const rows = reconcileHomeRows(stored, libs);
    expect(rows.map((r) => r.key)).toEqual(["resume", "reco:forYou", "library:L1", "reco:anime"]);
    expect(rows.at(-1)?.enabled).toBe(false);
  });

  it("déjà présente, elle garde sa place et son état", () => {
    const stored = [
      { key: "reco:anime", enabled: true },
      { key: "resume", enabled: true },
    ];
    expect(reconcileHomeRows(stored, [])).toEqual(stored);
  });

  it("les bibliothèques nouvelles passent avant elle, ancrées ou non", () => {
    const stored = [{ key: "resume", enabled: true }, { key: "watched", enabled: true }];
    expect(reconcileHomeRows(stored, libs).map((r) => r.key)).toEqual([
      "resume", "watched", "library:L1", "reco:anime",
    ]);
    expect(reconcileHomeRows(stored, libs, { anchorNewLibraries: true }).map((r) => r.key)).toEqual([
      "resume", "library:L1", "watched", "reco:anime",
    ]);
  });
});
