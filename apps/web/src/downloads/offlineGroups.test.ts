import { describe, expect, it } from "vitest";
import type { DownloadEntry } from "./api";
import {
  groupOfflineEntries,
  groupSeasonsBySeries,
  groupWatchState,
  seasonGroupMatches,
  seasonLabel,
  seriesGroupMatches,
  watchStateOf,
} from "./offlineGroups";

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
    autoDeleteDelayMinutes: 0,
    deleteScheduledAt: null,
    played: false,
    positionTicks: 0,
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

describe("groupSeasonsBySeries", () => {
  it("réunit les saisons d'une même série sous une seule carte", () => {
    const { seasons } = groupOfflineEntries([
      episode("Rick et Morty", 1, 1, "Pilote"),
      episode("Rick et Morty", 2, 1, "A Rickle in Time"),
      episode("Rick et Morty", 2, 2, "Mortynight Run"),
      episode("Breaking Bad", 1, 1, "Pilot"),
    ]);

    const series = groupSeasonsBySeries(seasons);

    // Quatre épisodes, trois saisons — mais deux cartes seulement.
    expect(series).toHaveLength(2);
    expect(series.map((s) => s.seriesName)).toEqual(["Breaking Bad", "Rick et Morty"]);
    const rick = series[1];
    expect(rick.seasons).toHaveLength(2);
    expect(rick.episodeCount).toBe(3);
  });

  it("ordonne les saisons par numéro, celles sans numéro à la fin", () => {
    const { seasons } = groupOfflineEntries([
      episode("Rick et Morty", 3, 1, "C"),
      episode("Rick et Morty", null, null, "Inconnue"),
      episode("Rick et Morty", 1, 1, "A"),
    ]);

    const rick = groupSeasonsBySeries(seasons)[0];

    expect(rick.seasons.map((s) => s.seasonNumber)).toEqual([1, 3, null]);
  });

  it("regroupe par nom quand l'identifiant de série manque", () => {
    const { seasons } = groupOfflineEntries([
      entry({ kind: "episode", seriesName: "Sans id", seriesId: null, seasonId: "a", parentIndexNumber: 1 }),
      entry({ kind: "episode", seriesName: "Sans id", seriesId: null, seasonId: "b", parentIndexNumber: 2 }),
    ]);

    expect(groupSeasonsBySeries(seasons)).toHaveLength(1);
  });

  it("la recherche traverse les saisons", () => {
    const { seasons } = groupOfflineEntries([
      episode("Rick et Morty", 1, 1, "Pilote"),
      episode("Rick et Morty", 2, 3, "Lawnmower Dog"),
    ]);
    const rick = groupSeasonsBySeries(seasons)[0];

    expect(seriesGroupMatches(rick, "lawnmower")).toBe(true);
    expect(seriesGroupMatches(rick, "rick")).toBe(true);
    expect(seriesGroupMatches(rick, "breaking bad")).toBe(false);
    expect(seriesGroupMatches(rick, "")).toBe(true);
  });
});

// Hors ligne, la vignette n'a AUCUN DTO serveur : ce que dit `watchStateOf` est
// la seule chose que l'utilisateur verra de sa progression.
describe("watchStateOf", () => {
  it("coche un item vu, sans barre", () => {
    expect(watchStateOf(entry({ played: true, positionTicks: 500, runtimeTicks: 1000 })))
      .toEqual({ watched: true, percent: null });
  });

  it("rend le pourcentage d'un item entame", () => {
    expect(watchStateOf(entry({ played: false, positionTicks: 250, runtimeTicks: 1000 })))
      .toEqual({ watched: false, percent: 25 });
  });

  it("ne rend rien sans progression", () => {
    expect(watchStateOf(entry({ positionTicks: 0, runtimeTicks: 1000 })))
      .toEqual({ watched: false, percent: null });
  });

  // Duree absente (telechargement herite, media non analyse cote Jellyfin) :
  // aucun pourcentage n'est calculable, et on n'en invente pas.
  it("ne rend rien sans duree connue", () => {
    expect(watchStateOf(entry({ positionTicks: 250, runtimeTicks: null })))
      .toEqual({ watched: false, percent: null });
  });

  it("borne a cent pour cent", () => {
    expect(watchStateOf(entry({ positionTicks: 1200, runtimeTicks: 1000 })).percent).toBe(100);
  });
});

describe("groupWatchState", () => {
  it("coche un groupe dont tout est vu", () => {
    expect(groupWatchState([entry({ played: true }), entry({ played: true })]).watched).toBe(true);
  });

  it("ne coche pas un groupe partiellement vu", () => {
    expect(groupWatchState([entry({ played: true }), entry({ played: false })]).watched).toBe(false);
  });

  it("ne coche pas un groupe vide", () => {
    expect(groupWatchState([]).watched).toBe(false);
  });
});

describe("seasonLabel", () => {
  it("nomme la saison, ou retombe sur le libellé générique", () => {
    const t = (key: string, options?: Record<string, unknown>): string =>
      key === "downloads:seasonLabel" ? `Saison ${String(options?.num)}` : "Épisodes";

    expect(seasonLabel(t, 2)).toBe("Saison 2");
    expect(seasonLabel(t, null)).toBe("Épisodes");
  });
});
