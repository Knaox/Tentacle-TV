import { describe, expect, it } from "vitest";
import type { DownloadEntry } from "./api";
import { groupOfflineEntries, seasonGroupMatches } from "./offlineGroups";

let nextId = 1;
function entry(over: Partial<DownloadEntry> = {}): DownloadEntry {
  const id = nextId++;
  return {
    id,
    itemId: `item${id}`,
    mediaSourceId: `ms${id}`,
    variant: "original",
    preset: null,
    relPath: `media/item${id}/original-ms${id}.mkv`,
    expectedSize: null,
    bytesDone: 0,
    status: "complete",
    errorCode: null,
    title: `Titre ${id}`,
    seriesName: null,
    kind: "movie",
    seriesId: null,
    seasonId: null,
    indexNumber: null,
    parentIndexNumber: null,
    runtimeTicks: null,
    autoDeleteAfterWatch: false,
    ...over,
  };
}

function episode(series: string, season: number | null, number: number | null, title: string) {
  return entry({
    kind: "episode",
    seriesName: series,
    seriesId: `s-${series}`,
    seasonId: season != null ? `${series}-saison${season}` : null,
    parentIndexNumber: season,
    indexNumber: number,
    title,
  });
}

describe("groupOfflineEntries", () => {
  it("sépare les films des saisons", () => {
    const { movies, seasons } = groupOfflineEntries([
      entry({ title: "Inception" }),
      episode("Rick et Morty", 1, 1, "Pilote"),
    ]);
    expect(movies.map((m) => m.title)).toEqual(["Inception"]);
    expect(seasons).toHaveLength(1);
    expect(seasons[0].seriesName).toBe("Rick et Morty");
    expect(seasons[0].seasonNumber).toBe(1);
  });

  it("groupe par saison, pas par série", () => {
    const { seasons } = groupOfflineEntries([
      episode("Rick et Morty", 1, 1, "Pilote"),
      episode("Rick et Morty", 2, 1, "Une autre saison"),
      episode("Rick et Morty", 1, 2, "Lawnmower Dog"),
    ]);
    expect(seasons).toHaveLength(2);
    expect(seasons.map((s) => s.seasonNumber)).toEqual([1, 2]);
    expect(seasons[0].episodes).toHaveLength(2);
  });

  it("trie les épisodes par numéro, pas par titre ni par date", () => {
    const { seasons } = groupOfflineEntries([
      episode("Série", 1, 10, "Aaa dernier"),
      episode("Série", 1, 2, "Zzz deuxième"),
      episode("Série", 1, 1, "Mmm premier"),
    ]);
    expect(seasons[0].episodes.map((e) => e.indexNumber)).toEqual([1, 2, 10]);
  });

  it("place les épisodes sans numéro en fin de liste, sans les perdre", () => {
    const { seasons } = groupOfflineEntries([
      episode("Série", 1, null, "Numéro inconnu"),
      episode("Série", 1, 1, "Premier"),
    ]);
    expect(seasons[0].episodes.map((e) => e.title)).toEqual(["Premier", "Numéro inconnu"]);
  });

  it("regroupe par série quand la saison est inconnue", () => {
    const { seasons } = groupOfflineEntries([
      episode("Série", null, 1, "Un"),
      episode("Série", null, 2, "Deux"),
    ]);
    expect(seasons).toHaveLength(1);
    expect(seasons[0].seasonNumber).toBeNull();
    expect(seasons[0].episodes).toHaveLength(2);
  });

  it("trie les saisons par série puis par numéro", () => {
    const { seasons } = groupOfflineEntries([
      episode("Zorro", 1, 1, "a"),
      episode("Alpha", 2, 1, "b"),
      episode("Alpha", 1, 1, "c"),
    ]);
    expect(seasons.map((s) => `${s.seriesName} ${s.seasonNumber}`))
      .toEqual(["Alpha 1", "Alpha 2", "Zorro 1"]);
  });

  it("expose l'item porteur des images du groupe", () => {
    const first = episode("Série", 1, 1, "Premier");
    const { seasons } = groupOfflineEntries([episode("Série", 1, 2, "Second"), first]);
    // Le premier épisode TRIÉ porte l'affiche, pas le premier reçu.
    expect(seasons[0].posterItemId).toBe(first.itemId);
  });
});

describe("seasonGroupMatches", () => {
  const { seasons } = groupOfflineEntries([
    episode("Rick et Morty", 1, 1, "Pilote"),
    episode("Rick et Morty", 1, 2, "Lawnmower Dog"),
  ]);

  it("trouve par nom de série ou d'épisode", () => {
    expect(seasonGroupMatches(seasons[0], "rick")).toBe(true);
    expect(seasonGroupMatches(seasons[0], "lawnmower")).toBe(true);
    expect(seasonGroupMatches(seasons[0], "breaking bad")).toBe(false);
    expect(seasonGroupMatches(seasons[0], "")).toBe(true);
  });
});
