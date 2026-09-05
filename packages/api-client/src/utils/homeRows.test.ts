import { describe, expect, it } from "vitest";
import {
  firstServedRecoRowKey,
  isHomeRowAvailable,
  mergeHiddenHomeRows,
  moveRow,
  reconcileHomeRows,
  visibleHomeRows,
} from "./homeRows";

const row = (key: string, enabled = true) => ({ key, enabled });
const keys = (rows: { key: string }[]) => rows.map((r) => r.key);
const libs = [{ id: "L1", name: "Films" }];
const CATALOG = [row("resume"), row("reco:forYou"), row("reco:anime", false), row("favorites", false)];

describe("réconciliation des rangées de l'accueil", () => {
  it("une rangée du catalogue née après la mise en page stockée s'ajoute en fin, éteinte", () => {
    const stored = [row("resume"), row("reco:forYou"), row("library:L1")];
    const rows = reconcileHomeRows(stored, libs, { catalog: CATALOG });
    expect(keys(rows)).toEqual(["resume", "reco:forYou", "library:L1", "reco:anime", "favorites"]);
    expect(rows.slice(-2).every((r) => !r.enabled)).toBe(true);
  });

  it("déjà présente, elle garde sa place et son état", () => {
    const stored = [row("reco:anime"), row("resume"), row("reco:forYou"), row("favorites")];
    expect(reconcileHomeRows(stored, [], { catalog: CATALOG })).toEqual(stored);
  });

  it("les bibliothèques nouvelles passent avant les rangées ajoutées, ancrées ou non", () => {
    const stored = [row("resume"), row("watched")];
    const catalog = [row("resume"), row("watched"), row("reco:anime", false)];
    expect(keys(reconcileHomeRows(stored, libs, { catalog }))).toEqual(["resume", "watched", "library:L1", "reco:anime"]);
    expect(keys(reconcileHomeRows(stored, libs, { catalog, anchorNewLibraries: true }))).toEqual([
      "resume", "library:L1", "watched", "reco:anime",
    ]);
  });

  it("une bibliothèque disparue s'efface, un doublon aussi, sans catalogue rien ne s'ajoute", () => {
    const stored = [row("resume"), row("library:GONE"), row("resume"), row("reco:banana")];
    expect(keys(reconcileHomeRows(stored, libs))).toEqual(["resume", "reco:banana", "library:L1"]);
  });

  it("une clé que le serveur ne sait plus servir reste stockée", () => {
    const stored = [row("resume"), row("reco:forYou"), row("watched")];
    const generic = [row("resume"), row("watched")];
    expect(keys(reconcileHomeRows(stored, [], { catalog: generic }))).toEqual(["resume", "reco:forYou", "watched"]);
  });
});

describe("visibleHomeRows / isHomeRowAvailable", () => {
  it("cache les clés hors catalogue, jamais les bibliothèques ; identité sans catalogue", () => {
    const rows = [row("resume"), row("reco:forYou"), row("library:L1"), row("favorites")];
    const generic = [row("resume"), row("favorites", false)];
    expect(keys(visibleHomeRows(rows, generic))).toEqual(["resume", "library:L1", "favorites"]);
    expect(visibleHomeRows(rows)).toBe(rows);
    expect(isHomeRowAvailable("library:X", generic)).toBe(true);
    expect(isHomeRowAvailable("reco:forYou", generic)).toBe(false);
    expect(isHomeRowAvailable("reco:forYou")).toBe(true);
  });
});

describe("mergeHiddenHomeRows", () => {
  const generic = [row("resume"), row("watched"), row("watchlist")];

  it("les cachées reprennent leur place derrière la visible qui les précédait", () => {
    const full = [row("resume"), row("reco:forYou"), row("watched"), row("reco:discover", false), row("watchlist")];
    const visible = [row("watchlist"), row("resume", false), row("watched")];
    expect(mergeHiddenHomeRows(full, visible, generic)).toEqual([
      row("watchlist"), row("resume", false), row("reco:forYou"), row("watched"), row("reco:discover", false),
    ]);
  });

  it("une cachée sans rangée visible avant elle ouvre la liste", () => {
    const full = [row("reco:forYou"), row("resume")];
    expect(keys(mergeHiddenHomeRows(full, [row("resume")], generic))).toEqual(["reco:forYou", "resume"]);
  });

  it("rien de caché : la liste visible, telle quelle", () => {
    const visible = [row("watched"), row("resume")];
    expect(mergeHiddenHomeRows([row("resume"), row("watched")], visible, generic)).toBe(visible);
  });
});

describe("firstServedRecoRowKey", () => {
  it("la première rangée reco ACTIVE de l'accueil que la page sert", () => {
    const rows = [row("resume"), row("reco:forYou", false), row("reco:discover"), row("reco:trending")];
    expect(firstServedRecoRowKey(rows, ["forYou", "trending"])).toBe("reco:trending");
    expect(firstServedRecoRowKey(rows, ["discover", "trending"])).toBe("reco:discover");
    expect(firstServedRecoRowKey(rows, [])).toBeNull();
  });
});

describe("moveRow", () => {
  it("déplace d'un cran, ignore les bornes", () => {
    const rows = [row("a"), row("b"), row("c")];
    expect(keys(moveRow(rows, 0, 2))).toEqual(["b", "c", "a"]);
    expect(moveRow(rows, 2, 3)).toBe(rows);
    expect(moveRow(rows, 1, 1)).toBe(rows);
  });
});
