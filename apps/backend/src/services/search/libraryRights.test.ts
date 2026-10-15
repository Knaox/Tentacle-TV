/**
 * Ce que la bibliothèque montre à un compte, et ce qu'elle lui cache : un
 * film de la bibliothèque que ses droits lui interdisent n'est pas « à
 * demander » — c'est le même film.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  engine: null as null | { items: Map<string, { id: string; type: string; tmdbId: string | null }> },
  access: null as null | { at: number; items: Map<string, unknown> },
}));
vi.mock("./catalog", () => ({ currentEngine: () => h.engine }));
vi.mock("./userAccess", () => ({ getUserAccess: async () => h.access }));

import { libraryRightsFor } from "./libraryRights";
import { allowedByRights } from "../reco/recoRights";

const item = (id: string, type: string, tmdbId: string | null) => [id, { id, type, tmdbId }] as const;

beforeEach(() => {
  h.engine = {
    items: new Map([
      item("aaaa", "Movie", "603"),
      item("bbbb", "Movie", "680"),
      item("cccc", "Series", "1399"),
      // Deux versions d'un même film, dans deux bibliothèques : l'une suffit.
      item("dddd", "Movie", "550"),
      item("eeee", "Movie", "550"),
    ]),
  };
  h.access = { at: 0, items: new Map([["aaaa", {}], ["CCCC", {}], ["eeee", {}]]) };
});

describe("libraryRightsFor", () => {
  it("un titre visible l'est, quelle que soit la casse ; un titre caché ne l'est pas", async () => {
    const rights = (await libraryRightsFor("enfant"))!;
    expect(rights.seesItem("aaaa")).toBe(true);
    expect(rights.seesItem("cccc")).toBe(true);
    expect(rights.seesItem("bbbb")).toBe(false);
  });

  it("une clé TMDB de la bibliothèque, cachée au compte, est « cachée » ; une clé hors bibliothèque ne l'est pas", async () => {
    const rights = (await libraryRightsFor("enfant"))!;
    expect(rights.hidesTitle("movie", 680)).toBe(true);
    expect(rights.hidesTitle("movie", 603)).toBe(false);
    expect(rights.hidesTitle("tv", 1399)).toBe(false);
    expect(rights.hidesTitle("movie", 550)).toBe(false);
    expect(rights.hidesTitle("movie", 99999)).toBe(false);
    // Une série et un film ne partagent pas leur numéro TMDB.
    expect(rights.hidesTitle("tv", 680)).toBe(false);
  });

  it("catalogue ou relevé du compte absents : rien à juger (null)", async () => {
    h.access = null;
    expect(await libraryRightsFor("enfant")).toBeNull();
    h.engine = null;
    expect(await libraryRightsFor("enfant")).toBeNull();
  });
});

describe("allowedByRights (une ligne de recommandation)", () => {
  it("bibliothèque visible : oui ; cachée : non ; extérieur caché dans la bibliothèque : non ; autre extérieur : oui", async () => {
    const rights = await libraryRightsFor("enfant");
    expect(allowedByRights(rights, { mediaType: "movie", tmdbId: 603, jellyfinItemId: "aaaa" })).toBe(true);
    expect(allowedByRights(rights, { mediaType: "movie", tmdbId: 680, jellyfinItemId: "bbbb" })).toBe(false);
    expect(allowedByRights(rights, { mediaType: "movie", tmdbId: 680, jellyfinItemId: null })).toBe(false);
    expect(allowedByRights(rights, { mediaType: "movie", tmdbId: 12, jellyfinItemId: null })).toBe(true);
  });

  it("droits illisibles : la bibliothèque (calculée au nom du compte) reste, l'extérieur part", () => {
    expect(allowedByRights(null, { mediaType: "movie", tmdbId: 603, jellyfinItemId: "aaaa" })).toBe(true);
    expect(allowedByRights(null, { mediaType: "movie", tmdbId: 12, jellyfinItemId: null })).toBe(false);
  });
});
