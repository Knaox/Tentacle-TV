import { describe, expect, it } from "vitest";
import { sortSagaParts, type SagaPart } from "./sagaTypes";

/** L'ordre d'une saga : la date de sortie, les volets annoncés en dernier. */

const part = (tmdbId: number, releaseDate: string | null): SagaPart => ({ tmdbId, title: `#${tmdbId}`, releaseDate });

describe("sortSagaParts", () => {
  it("range par date de sortie — TMDB ne trie pas ses volets", () => {
    // L'ordre réel de TMDB pour Harry Potter : Azkaban arrive cinquième.
    const tmdb = [part(671, "2001-11-16"), part(672, "2002-11-13"), part(674, "2005-11-16"), part(767, "2009-07-15"), part(673, "2004-05-31")];
    expect(sortSagaParts(tmdb).map((p) => p.tmdbId)).toEqual([671, 672, 673, 674, 767]);
  });

  it("un volet sans date (annoncé) passe après les autres, dans l'ordre de TMDB", () => {
    const tmdb = [part(3, null), part(1, "2002-10-31"), part(4, null), part(2, "2007-04-26")];
    expect(sortSagaParts(tmdb).map((p) => p.tmdbId)).toEqual([1, 2, 3, 4]);
  });

  it("à date égale, l'ordre de TMDB départage, et la liste d'entrée n'est pas touchée", () => {
    const tmdb = [part(2, "2010-01-01"), part(1, "2010-01-01")];
    expect(sortSagaParts(tmdb).map((p) => p.tmdbId)).toEqual([2, 1]);
    expect(tmdb.map((p) => p.tmdbId)).toEqual([2, 1]);
  });
});
