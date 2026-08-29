/**
 * Le supplément « à suivre » de l'accueil — il ne recule jamais.
 *
 * Ces cas sont ceux de `watchState.test.ts`, vus depuis l'accueil : la règle
 * est la même des deux côtés, et c'est bien le but — la fiche et le carrousel
 * ne doivent pas proposer deux épisodes différents.
 */

import { describe, expect, it } from "vitest";
import type { MediaItem } from "@tentacle-tv/shared";
import {
  buildSmartNextUp, buildWatchAnchors, findStaleSuggestions, realignNextUp,
} from "./mediaFilters";

const ep = (seriesId: string, season: number, episode: number): MediaItem =>
  ({
    Id: `${seriesId}-s${season}e${episode}`,
    Name: `S${season}E${episode}`,
    Type: "Episode" as const,
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

/**
 * Le cas RELEVÉ SUR L'INSTANCE, le 29/08 : une série de 1 434 épisodes dont dix
 * de la saison 2 avaient été marqués vus en lot. `/Shows/NextUp` reproposait
 * S01E01 — derrière la dernière lecture, donc contraire à la règle.
 */
describe("realignNextUp — quand le serveur propose en arrière", () => {
  const anchorsOf = (...eps: MediaItem[]) => buildWatchAnchors(eps);

  it("repère la proposition située derrière l'ancre", () => {
    const anchors = anchorsOf(ep("op", 2, 19));
    const stale = findStaleSuggestions([ep("op", 1, 1)], anchors);
    expect(stale).toHaveLength(1);
    expect(stale[0]).toMatchObject({ seriesId: "op" });
    expect(stale[0].suggested.Id).toBe("op-s1e1");
    expect(stale[0].anchor.Id).toBe("op-s2e19");
  });

  it("ne touche pas une proposition déjà en avant de l'ancre", () => {
    const anchors = anchorsOf(ep("op", 2, 19));
    expect(findStaleSuggestions([ep("op", 2, 20)], anchors)).toEqual([]);
    expect(realignNextUp([ep("op", 2, 20)], anchors, new Map())).toHaveLength(1);
  });

  it("remplace la proposition périmée par le successeur résolu", () => {
    const anchors = anchorsOf(ep("op", 2, 19));
    const out = realignNextUp(
      [ep("op", 1, 1)],
      anchors,
      new Map([["op", ep("op", 2, 20)]]),
    );
    expect(ids(out)).toEqual(["op-s2e20"]);
  });

  it("retire la proposition tant que le successeur n'est pas résolu", () => {
    const anchors = anchorsOf(ep("op", 2, 19));
    expect(realignNextUp([ep("op", 1, 1)], anchors, new Map())).toEqual([]);
  });

  it("retire la série quand il n'y a rien après l'ancre", () => {
    const anchors = anchorsOf(ep("op", 2, 19));
    const out = realignNextUp([ep("op", 1, 1)], anchors, new Map([["op", null]]));
    expect(out).toEqual([]);
  });

  it("une série jamais regardée n'a pas d'ancre : la proposition passe", () => {
    const out = realignNextUp([ep("neuf", 1, 1)], anchorsOf(ep("op", 2, 19)), new Map());
    expect(ids(out)).toEqual(["neuf-s1e1"]);
  });

  it("l'ancre est la lecture la plus RÉCENTE, pas la plus avancée", () => {
    // `engagedEpisodes` arrive trié par DatePlayed décroissant.
    const anchors = buildWatchAnchors([ep("op", 2, 5), ep("op", 4, 30)]);
    expect(anchors.get("op")?.Id).toBe("op-s2e5");
  });

  it("le plafond borne le nombre de requêtes que l'appelant fera", () => {
    const anchors = buildWatchAnchors([
      ep("a", 2, 9), ep("b", 2, 9), ep("c", 2, 9), ep("d", 2, 9), ep("e", 2, 9),
    ]);
    const items = ["a", "b", "c", "d", "e"].map((s) => ep(s, 1, 1));
    expect(findStaleSuggestions(items, anchors)).toHaveLength(4);
    expect(findStaleSuggestions(items, anchors, 2)).toHaveLength(2);
  });
});
