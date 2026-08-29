/**
 * Le supplément « à suivre » de l'accueil — il ne recule jamais.
 *
 * Ces cas sont ceux de `watchState.test.ts`, vus depuis l'accueil : la règle
 * est la même des deux côtés, et c'est bien le but — la fiche et le carrousel
 * ne doivent pas proposer deux épisodes différents.
 */

import { describe, expect, it } from "vitest";
import type { MediaItem } from "@tentacle-tv/shared";
import { buildSmartNextUp } from "./mediaFilters";

const ep = (seriesId: string, season: number, episode: number): MediaItem =>
  ({
    Id: `${seriesId}-s${season}e${episode}`,
    Name: `S${season}E${episode}`,
    Type: "Episode",
    SeriesId: seriesId,
    ParentIndexNumber: season,
    IndexNumber: episode,
  }) as MediaItem;

const ids = (items: MediaItem[]): string[] => items.map((i) => i.Id);

describe("buildSmartNextUp", () => {
  it("LE CAS SIGNALÉ — après l'épisode 6, on propose le 7, pas le premier trou", () => {
    const unwatched = [1, 2, 3, 4, 5, 7, 8].map((n) => ep("re", 1, n));
    expect(ids(buildSmartNextUp(unwatched, [ep("re", 1, 6)]))).toEqual(["re-s1e7"]);
  });

  it("les trous laissés derrière ne remontent jamais", () => {
    const unwatched = [ep("re", 1, 1), ep("re", 1, 2), ep("re", 1, 4)];
    // Dernière lecture : le 5. Le 4, le 2 et le 1 sont derrière — rien à proposer.
    expect(buildSmartNextUp(unwatched, [ep("re", 1, 5)])).toEqual([]);
  });

  it("la fin d'une saison enchaîne sur la suivante", () => {
    const unwatched = [ep("re", 2, 1), ep("re", 2, 2)];
    expect(ids(buildSmartNextUp(unwatched, [ep("re", 1, 12)]))).toEqual(["re-s2e1"]);
  });

  it("une série par ancre, dans l'ordre de la dernière lecture", () => {
    const unwatched = [ep("a", 1, 3), ep("b", 1, 2), ep("a", 1, 4)];
    const engaged = [ep("b", 1, 1), ep("a", 1, 2), ep("a", 1, 1)];
    expect(ids(buildSmartNextUp(unwatched, engaged))).toEqual(["b-s1e2", "a-s1e3"]);
  });

  it("le plafond est respecté", () => {
    const unwatched = [ep("a", 1, 2), ep("b", 1, 2), ep("c", 1, 2)];
    const engaged = [ep("a", 1, 1), ep("b", 1, 1), ep("c", 1, 1)];
    expect(buildSmartNextUp(unwatched, engaged, 2)).toHaveLength(2);
  });

  it("une série sans épisode non vu ne paraît pas", () => {
    expect(buildSmartNextUp([], [ep("a", 1, 1)])).toEqual([]);
  });
});
