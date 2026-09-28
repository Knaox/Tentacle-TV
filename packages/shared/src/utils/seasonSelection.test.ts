/**
 * Le choix de la saison à l'ouverture d'une liste d'épisodes, par des cas.
 *
 * Le cas qui a motivé la règle : une longue série dont l'état de visionnage
 * arrive APRÈS les saisons. La liste s'ouvrait sur « Spéciaux » et y restait.
 */

import { describe, expect, it } from "vitest";
import type { MediaItem } from "../types/media";
import type { NextEpisodeResult } from "../watchState";
import { adjacentSeasonIds, resolveSeasonSelection } from "./seasonSelection";

const season = (index: number, played = false, playedPercentage?: number): MediaItem =>
  ({
    Id: `season-${index}`,
    Name: index === 0 ? "Spéciaux" : `Saison ${index}`,
    Type: "Season",
    IndexNumber: index,
    UserData: { PlaybackPositionTicks: 0, PlayCount: 0, IsFavorite: false, Played: played, PlayedPercentage: playedPercentage },
  }) as MediaItem;

const episodeOf = (seasonIndex: number): MediaItem =>
  ({ Id: `ep-${seasonIndex}`, Type: "Episode", SeasonId: `season-${seasonIndex}`, ParentIndexNumber: seasonIndex, IndexNumber: 1 }) as MediaItem;

/** Spéciaux, puis trois saisons dont la première est vue. */
const SEASONS = [season(0), season(1, true), season(2), season(3)];

describe("resolveSeasonSelection", () => {
  it("pendant l'attente de l'état de visionnage, montre la saison pressentie — jamais les spéciaux", () => {
    // La saison 1 est vue : la suivante.
    expect(resolveSeasonSelection({ seasons: SEASONS, watchPending: true })).toMatchObject({
      seasonId: "season-2",
      provisionalSeasonId: "season-2",
    });
  });

  it("sans provisoire (téléviseur), l'attente ne montre rien mais désigne quoi précharger", () => {
    const result = resolveSeasonSelection({ seasons: SEASONS, watchPending: true, provisional: false });
    expect(result.seasonId).toBeUndefined();
    expect(result.provisionalSeasonId).toBe("season-2");
  });

  it("l'état de visionnage corrige la saison pressentie en arrivant", () => {
    const pending = resolveSeasonSelection({ seasons: SEASONS, watchPending: true });
    const arrived = resolveSeasonSelection({ seasons: SEASONS, watchState: { type: "continue", episode: episodeOf(3), positionTicks: 1 } });
    expect([pending.seasonId, arrived.seasonId]).toEqual(["season-2", "season-3"]);
  });

  it("la saison pressentie suit la dernière saison entamée, pas le premier trou", () => {
    // Saison 2 entamée puis abandonnée (un épisode de remplissage sauté), saison 3 en cours.
    const skipped = [season(0), season(1, true), season(2, false, 90), season(3, false, 40), season(4)];
    expect(resolveSeasonSelection({ seasons: skipped, watchPending: true }).provisionalSeasonId).toBe("season-3");
    // Dernière saison entamée terminée : la suivante.
    const finished = [season(1, true), season(2, true), season(3)];
    expect(resolveSeasonSelection({ seasons: finished, watchPending: true }).provisionalSeasonId).toBe("season-3");
    // Tout est vu : la première, comme l'état « terminée » le décidera.
    const all = [season(0), season(1, true), season(2, true)];
    expect(resolveSeasonSelection({ seasons: all, watchPending: true }).provisionalSeasonId).toBe("season-1");
    // Rien de vu : la première vraie saison.
    expect(resolveSeasonSelection({ seasons: [season(0), season(1), season(2)], watchPending: true }).provisionalSeasonId).toBe("season-1");
  });

  it("ouvre la saison de l'épisode à reprendre et la marque", () => {
    const watchState: NextEpisodeResult = { type: "continue", episode: episodeOf(3), positionTicks: 10 };
    expect(resolveSeasonSelection({ seasons: SEASONS, watchState })).toMatchObject({
      seasonId: "season-3",
      currentSeasonId: "season-3",
    });
  });

  it("la saison imposée (fiche d'un épisode) l'emporte, le marqueur suit la reprise", () => {
    const watchState: NextEpisodeResult = { type: "next", episode: episodeOf(3) };
    expect(resolveSeasonSelection({ seasons: SEASONS, preferredSeasonId: "season-1", watchState, watchPending: true })).toMatchObject({
      seasonId: "season-1",
      currentSeasonId: "season-3",
    });
  });

  it("une série terminée ou sans état ouvre la première vraie saison, jamais les spéciaux", () => {
    expect(resolveSeasonSelection({ seasons: SEASONS, watchState: { type: "completed" } })).toMatchObject({
      seasonId: "season-1",
      currentSeasonId: undefined,
    });
    expect(resolveSeasonSelection({ seasons: SEASONS }).seasonId).toBe("season-1");
  });

  it("ignore une saison inconnue de la liste (état d'une autre série, saison retirée)", () => {
    const watchState: NextEpisodeResult = { type: "start", episode: episodeOf(9) };
    expect(resolveSeasonSelection({ seasons: SEASONS, preferredSeasonId: "ailleurs", watchState })).toMatchObject({
      seasonId: "season-1",
      currentSeasonId: undefined,
    });
  });

  it("une série sans saison régulière se rabat sur ce qu'elle a", () => {
    expect(resolveSeasonSelection({ seasons: [season(0)] }).seasonId).toBe("season-0");
    expect(resolveSeasonSelection({ seasons: [] }).seasonId).toBeUndefined();
    expect(resolveSeasonSelection({ seasons: undefined }).seasonId).toBeUndefined();
  });
});

describe("adjacentSeasonIds", () => {
  it("rend la suivante puis la précédente", () => {
    expect(adjacentSeasonIds(SEASONS, "season-2")).toEqual(["season-3", "season-1"]);
  });

  it("s'arrête aux bords et ignore une saison inconnue", () => {
    expect(adjacentSeasonIds(SEASONS, "season-3")).toEqual(["season-2"]);
    expect(adjacentSeasonIds(SEASONS, "season-0")).toEqual(["season-1"]);
    expect(adjacentSeasonIds(SEASONS, "inconnue")).toEqual([]);
    expect(adjacentSeasonIds(undefined, "season-1")).toEqual([]);
  });
});
