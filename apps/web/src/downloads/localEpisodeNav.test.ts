import { describe, expect, it } from "vitest";
import type { DownloadEntry, DownloadStatus } from "./api";
import { findAdjacentLocalEpisodes } from "./localEpisodeNav";

function entry(over: Partial<DownloadEntry> & { itemId: string }): DownloadEntry {
  return {
    id: Number(over.itemId.replace(/\D/g, "")) || 1,
    mediaSourceId: "ms",
    variant: "original",
    preset: null,
    relPath: `media/${over.itemId}/original-ms.mkv`,
    expectedSize: null,
    bytesDone: 0,
    status: "complete",
    errorCode: null,
    title: over.itemId,
    seriesName: "Rick et Morty",
    kind: "episode",
    seriesId: "serie1",
    seasonId: null,
    indexNumber: null,
    parentIndexNumber: null,
    runtimeTicks: null,
    autoDeleteAfterWatch: false,
    autoDeleteDelayMinutes: 0,
    deleteScheduledAt: null,
    played: false,
    positionTicks: 0,
    ...over,
  };
}

const ep = (id: string, season: number, number: number, over: Partial<DownloadEntry> = {}) =>
  entry({ itemId: id, parentIndexNumber: season, indexNumber: number, title: `S${season}E${number}`, ...over });

describe("findAdjacentLocalEpisodes", () => {
  it("donne l'épisode suivant et le précédent dans l'ordre de diffusion", () => {
    const list = [ep("c", 1, 3), ep("a", 1, 1), ep("b", 1, 2)];
    const nav = findAdjacentLocalEpisodes(list, "b");
    expect(nav.previousEpisode?.Id).toBe("a");
    expect(nav.nextEpisode?.Id).toBe("c");
  });

  it("enchaîne sur la saison suivante", () => {
    const list = [ep("s1e2", 1, 2), ep("s2e1", 2, 1)];
    expect(findAdjacentLocalEpisodes(list, "s1e2").nextEpisode?.Id).toBe("s2e1");
    expect(findAdjacentLocalEpisodes(list, "s2e1").previousEpisode?.Id).toBe("s1e2");
  });

  it("s'arrête aux extrémités", () => {
    const list = [ep("a", 1, 1), ep("b", 1, 2)];
    expect(findAdjacentLocalEpisodes(list, "a").previousEpisode).toBeNull();
    expect(findAdjacentLocalEpisodes(list, "b").nextEpisode).toBeNull();
  });

  it("ne traverse pas les séries", () => {
    const list = [
      ep("rm1", 1, 1),
      ep("bb1", 1, 2, { itemId: "bb1", seriesId: "serie2", seriesName: "Breaking Bad" }),
    ];
    expect(findAdjacentLocalEpisodes(list, "rm1").nextEpisode).toBeNull();
  });

  it("ignore les téléchargements incomplets — ils seraient illisibles", () => {
    const list = [
      ep("a", 1, 1),
      ep("b", 1, 2, { status: "downloading" as DownloadStatus }),
      ep("c", 1, 3),
    ];
    // On saute l'épisode 2 en cours de transfert pour proposer le 3.
    expect(findAdjacentLocalEpisodes(list, "a").nextEpisode?.Id).toBe("c");
  });

  it("ignore les films et les épisodes d'une autre série sans identifiant", () => {
    const list = [
      ep("a", 1, 1),
      entry({ itemId: "film", kind: "movie", seriesId: null, seriesName: null }),
      ep("b", 1, 2),
    ];
    expect(findAdjacentLocalEpisodes(list, "a").nextEpisode?.Id).toBe("b");
  });

  it("ne renvoie rien pour un item absent des téléchargements", () => {
    const nav = findAdjacentLocalEpisodes([ep("a", 1, 1)], "inconnu");
    expect(nav.previousEpisode).toBeNull();
    expect(nav.nextEpisode).toBeNull();
  });

  it("expose de quoi afficher le prochain épisode (titre, numéros, durée)", () => {
    const list = [ep("a", 2, 4), ep("b", 2, 5, { title: "Rixty Minutes", runtimeTicks: 13_200_000_000 })];
    const next = findAdjacentLocalEpisodes(list, "a").nextEpisode;
    expect(next).toMatchObject({
      Id: "b",
      Name: "Rixty Minutes",
      Type: "Episode",
      ParentIndexNumber: 2,
      IndexNumber: 5,
      RunTimeTicks: 13_200_000_000,
      SeriesName: "Rick et Morty",
    });
  });

  it("regroupe par nom de série quand l'identifiant manque", () => {
    const list = [
      ep("a", 1, 1, { seriesId: null }),
      ep("b", 1, 2, { seriesId: null }),
    ];
    expect(findAdjacentLocalEpisodes(list, "a").nextEpisode?.Id).toBe("b");
  });
});
