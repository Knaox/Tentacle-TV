import { describe, expect, it } from "vitest";
import {
  effectiveLibraryAccess,
  libraryAccessOfPolicy,
  librariesWithin,
  parseLibrariesBody,
  rebaseLibraryAccess,
  sameLibraryAccess,
  storedWantedLibraries,
  withLibraryAccess,
} from "./familyLibraryRules";

const FILMS = "11111111111111111111111111111111";
const SERIES = "22222222-2222-2222-2222-222222222222";
const KIDS = "33333333333333333333333333333333";

describe("effectiveLibraryAccess — jamais plus large que le plafond", () => {
  it("aucune liste voulue : le plafond tel quel", () => {
    expect(effectiveLibraryAccess({ all: true, ids: [] }, null)).toEqual({ all: true, ids: [] });
    expect(effectiveLibraryAccess({ all: false, ids: [FILMS] }, null)).toEqual({ all: false, ids: [FILMS] });
  });

  it("plafond « toutes » : la liste voulue", () => {
    expect(effectiveLibraryAccess({ all: true, ids: [] }, [KIDS])).toEqual({ all: false, ids: [KIDS] });
  });

  it("plafond en liste : l'intersection, identifiants comparés sans tirets ni casse", () => {
    const ceiling = { all: false, ids: [FILMS, SERIES.replace(/-/g, "").toUpperCase()] };
    expect(effectiveLibraryAccess(ceiling, [SERIES, KIDS])).toEqual({ all: false, ids: [SERIES] });
  });

  it("plus rien en commun : aucune bibliothèque, rien ne s'élargit", () => {
    expect(effectiveLibraryAccess({ all: false, ids: [FILMS] }, [KIDS])).toEqual({ all: false, ids: [] });
  });
});

describe("politique Jellyfin", () => {
  it("se lit telle quelle ; absente : aucune", () => {
    expect(libraryAccessOfPolicy({ EnableAllFolders: true, EnabledFolders: [FILMS] })).toEqual({ all: true, ids: [FILMS] });
    expect(libraryAccessOfPolicy({})).toEqual({ all: false, ids: [] });
  });

  it("s'écrit sans toucher au reste", () => {
    expect(withLibraryAccess({ MaxParentalRating: 12, EnableAllFolders: true }, { all: false, ids: [KIDS] })).toEqual({
      MaxParentalRating: 12,
      EnableAllFolders: false,
      EnabledFolders: [KIDS],
    });
  });

  it("deux accès se comparent sans ordre", () => {
    expect(sameLibraryAccess({ all: false, ids: [FILMS, KIDS] }, { all: false, ids: [KIDS, FILMS] })).toBe(true);
    expect(sameLibraryAccess({ all: true, ids: [] }, { all: false, ids: [] })).toBe(false);
  });
});

describe("rebaseLibraryAccess — l'administrateur prime", () => {
  const base = { all: true, ids: [] };
  const written = { all: false, ids: [KIDS] };

  it("rien n'a bougé depuis la dernière écriture : la base reste", () => {
    expect(rebaseLibraryAccess(base, written, { all: false, ids: [KIDS] })).toBe(base);
  });

  it("changé ailleurs : la valeur lue devient la base (rendue au départ)", () => {
    expect(rebaseLibraryAccess(base, written, { all: false, ids: [FILMS] })).toEqual({ all: false, ids: [FILMS] });
  });
});

describe("librariesWithin", () => {
  it("garde l'ordre du serveur", () => {
    const libraries = [{ id: FILMS }, { id: SERIES }, { id: KIDS }];
    expect(librariesWithin(libraries, { all: false, ids: [KIDS, FILMS] })).toEqual([{ id: FILMS }, { id: KIDS }]);
    expect(librariesWithin(libraries, { all: true, ids: [] })).toHaveLength(3);
  });
});

describe("parseLibrariesBody — le corps EXACT", () => {
  it("null ou une liste d'identifiants", () => {
    expect(parseLibrariesBody({ allowed: null })).toEqual({ allowed: null });
    expect(parseLibrariesBody({ allowed: [FILMS, SERIES] })).toEqual({ allowed: [FILMS, SERIES] });
  });

  it("refuse le reste : vide, doublon, clé en trop, non-identifiant", () => {
    for (const body of [
      null,
      [],
      {},
      { allowed: [] },
      { allowed: [FILMS, FILMS.toUpperCase()] },
      { allowed: [FILMS], userId: KIDS },
      { allowed: ["films"] },
      { allowed: [42] },
      { allowed: "all" },
    ]) {
      expect(parseLibrariesBody(body)).toBeNull();
    }
  });
});

describe("storedWantedLibraries", () => {
  it("absente : toutes ; illisible : aucune, jamais « toutes »", () => {
    expect(storedWantedLibraries(null)).toBeNull();
    expect(storedWantedLibraries(JSON.stringify([KIDS]))).toEqual([KIDS]);
    expect(storedWantedLibraries("{oups")).toEqual([]);
    expect(storedWantedLibraries(JSON.stringify({ all: true }))).toEqual([]);
  });
});
