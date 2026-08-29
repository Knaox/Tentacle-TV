/**
 * L'épisode suivant d'une série — la règle demandée, énoncée par des cas.
 *
 * « Le prochain épisode est toujours le suivant de celui qu'on vient de
 * regarder. » Ce fichier existe parce que l'ancien algorithme — premier
 * épisode non terminé — rendait exactement l'inverse dès qu'on ne regarde pas
 * dans l'ordre, et que rien ne le disait.
 */

import { describe, expect, it } from "vitest";
import type { MediaItem } from "./types/media";
import { getNextEpisode } from "./watchState";

const TICKS_PER_MINUTE = 600_000_000;

interface EpisodeSpec {
  season?: number;
  episode: number;
  played?: boolean;
  positionTicks?: number;
  playedAt?: string;
}

const ep = ({ season = 1, episode, played, positionTicks, playedAt }: EpisodeSpec): MediaItem =>
  ({
    Id: `s${season}e${episode}`,
    Name: `S${season}E${episode}`,
    Type: "Episode",
    ParentIndexNumber: season,
    IndexNumber: episode,
    UserData: {
      PlaybackPositionTicks: positionTicks ?? 0,
      PlayCount: played ? 1 : 0,
      IsFavorite: false,
      Played: played === true,
      ...(playedAt ? { LastPlayedDate: playedAt } : {}),
    },
  }) as MediaItem;

/** Une saison de huit épisodes, aucun vu. */
const SEASON_LENGTH = 8;
type SeasonPatch = Record<number, Omit<EpisodeSpec, "episode">>;
const season = (patch: SeasonPatch = {}): MediaItem[] =>
  Array.from({ length: SEASON_LENGTH }, (_, i) => ep({ ...patch[i + 1], episode: i + 1 }));

describe("getNextEpisode — l'ancre est la dernière lecture", () => {
  it("rien de vu : on commence par le premier", () => {
    expect(getNextEpisode(season())).toEqual({ type: "start", episode: expect.objectContaining({ Id: "s1e1" }) });
  });

  it("LE CAS SIGNALÉ — commencer par le milieu et le finir propose la SUITE, pas le premier trou", () => {
    // 1, 2, 4 et 5 jamais vus ; on regarde le 6 et on le termine → 7.
    const episodes = season({ 6: { played: true, playedAt: "2026-08-29T10:00:00Z" } });
    expect(getNextEpisode(episodes)).toMatchObject({
      type: "next",
      episode: expect.objectContaining({ Id: "s1e7" }),
    });
  });

  it("les trous laissés derrière ne rappellent jamais l'ancre en arrière", () => {
    // 3 vu il y a longtemps, 6 vu aujourd'hui : c'est 6 qui commande, et les
    // trous 1, 2, 4, 5 ne pèsent rien.
    const episodes = season({
      3: { played: true, playedAt: "2026-08-20T10:00:00Z" },
      6: { played: true, playedAt: "2026-08-29T10:00:00Z" },
    });
    expect(getNextEpisode(episodes)).toMatchObject({
      type: "next",
      episode: expect.objectContaining({ Id: "s1e7" }),
    });
  });

  it("un épisode entamé l'emporte sur tout : on le reprend", () => {
    const episodes = season({
      2: { played: true, playedAt: "2026-08-29T10:00:00Z" },
      5: { positionTicks: 12 * TICKS_PER_MINUTE, playedAt: "2026-08-29T11:00:00Z" },
    });
    expect(getNextEpisode(episodes)).toEqual({
      type: "continue",
      episode: expect.objectContaining({ Id: "s1e5" }),
      positionTicks: 12 * TICKS_PER_MINUTE,
    });
  });

  it("la fin d'une saison enchaîne sur la suivante", () => {
    const episodes = [
      ...season({ 8: { played: true, playedAt: "2026-08-29T10:00:00Z" } }),
      ep({ season: 2, episode: 1 }),
      ep({ season: 2, episode: 2 }),
    ];
    expect(getNextEpisode(episodes)).toMatchObject({
      type: "next",
      episode: expect.objectContaining({ Id: "s2e1" }),
    });
  });

  it("marquer un épisode non lu ne le repropose pas comme suivant", () => {
    // On a regardé 4 puis 5 ; on remet 5 en non lu. L'ancre redevient 4, donc
    // la proposition est 5 — mais parce qu'il SUIT 4, jamais parce qu'il est
    // le premier trou : 1, 2 et 3 sont non vus et ne remontent pas.
    const episodes = season({
      4: { played: true, playedAt: "2026-08-29T10:00:00Z" },
      5: {},
    });
    expect(getNextEpisode(episodes)).toMatchObject({
      type: "next",
      episode: expect.objectContaining({ Id: "s1e5" }),
    });
  });

  it("sans date de lecture, le dernier terminé DANS L'ORDRE sert d'ancre", () => {
    const episodes = season({
      2: { played: true },
      4: { played: true },
    });
    expect(getNextEpisode(episodes)).toMatchObject({
      type: "next",
      episode: expect.objectContaining({ Id: "s1e5" }),
    });
  });

  it("tout vu jusqu'au dernier : la série est terminée", () => {
    const episodes = Array.from({ length: SEASON_LENGTH }, (_, i) =>
      ep({ episode: i + 1, played: true, playedAt: `2026-08-0${i + 1}T10:00:00Z` }),
    );
    expect(getNextEpisode(episodes)).toEqual({ type: "completed" });
  });

  it("une liste vide ne casse pas", () => {
    expect(getNextEpisode([])).toEqual({ type: "completed" });
  });
});
