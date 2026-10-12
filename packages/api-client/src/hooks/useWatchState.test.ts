import { describe, expect, it } from "vitest";
import type { MediaItem } from "@tentacle-tv/shared";
import { fetchSeriesWatchState } from "./useWatchState";

/**
 * L'état de visionnage d'une série, qui décide du bouton « Lecture » de sa
 * fiche sur toutes les plateformes. Une série que Jellyfin n'a pas identifiée
 * peut rendre des épisodes SANS numéro de saison : les écarter vidait la liste,
 * lue comme « série terminée » — plus aucun bouton pour la commencer.
 */

const episode = (id: string, season: number | undefined, index: number, extra: Partial<MediaItem> = {}): MediaItem => ({
  Id: id,
  Name: id,
  Type: "Episode",
  ParentIndexNumber: season,
  IndexNumber: index,
  ...extra,
});

const fetcher = (items: unknown) => ({ fetch: async () => ({ Items: items }) });

describe("fetchSeriesWatchState", () => {
  it("des épisodes sans numéro de saison restent jouables : on commence par le premier", async () => {
    const result = await fetchSeriesWatchState(fetcher([episode("e2", undefined, 2), episode("e1", undefined, 1)]), "u", "s");
    expect(result).toEqual({ type: "start", episode: expect.objectContaining({ Id: "e1" }) });
  });

  it("les spéciaux DÉCLARÉS (saison 0) restent écartés, les saisons dans l'ordre", async () => {
    const result = await fetchSeriesWatchState(
      fetcher([episode("special", 0, 1), episode("s2e1", 2, 1), episode("s1e1", 1, 1)]),
      "u",
      "s",
    );
    expect(result).toEqual({ type: "start", episode: expect.objectContaining({ Id: "s1e1" }) });
  });

  it("un épisode sans saison se range APRÈS les saisons numérotées", async () => {
    const result = await fetchSeriesWatchState(
      fetcher([
        episode("loose", undefined, 1),
        episode("s1e1", 1, 1, { UserData: { Played: true, PlaybackPositionTicks: 0, PlayCount: 1, IsFavorite: false } }),
      ]),
      "u",
      "s",
    );
    expect(result).toEqual({ type: "next", episode: expect.objectContaining({ Id: "loose" }) });
  });

  it("une réponse sans Items reste une erreur, jamais une série terminée", async () => {
    await expect(fetchSeriesWatchState({ fetch: async () => ({}) }, "u", "s")).rejects.toThrow();
  });
});
