import type { MediaItem, NextEpisodeResult } from "@tentacle-tv/shared";

/** Les horloges du téléviseur et du serveur : l'écart toléré, en faveur du serveur. */
const CLOCK_SKEW_MS = 2_000;

/**
 * L'état de visionnage d'une SÉRIE à la relance à froid, quand Jellyfin n'a
 * pas écrit l'arrêt du marqueur (12.1 l'accuse parfois sans l'écrire).
 *
 * La fiche de la série tire « Reprendre S1 · E5 », sa jauge et sa saison de
 * l'état de visionnage (`useSeriesWatchState`), que le serveur calcule sur ses
 * propres reprises — périmées dans ce cas : l'ancienne position, ou un autre
 * épisode quand rien n'avait été écrit. La position du marqueur, adoptée sur
 * l'épisode (la date gagne), doit y arriver aussi.
 *
 * Même règle que `getNextEpisode` (shared) : un épisode ENTAMÉ l'emporte, le
 * plus récent s'il y en a plusieurs. Notre arrêt est le plus récent — sauf si
 * le serveur montre un autre épisode entamé APRÈS lui (un autre appareil) :
 * la date gagne, le serveur a raison.
 *
 * `stop` : l'épisode tel que l'adoption l'a patché, et sa reprise. Une REPRISE
 * seulement (position > 0, pas « vu ») : un arrêt au tout début ou à la fin
 * laisse le verdict au serveur, qui en déduit seul l'épisode suivant.
 */
export function seriesResumeAfterStop(
  server: NextEpisodeResult,
  stop: { episode: MediaItem; positionTicks: number; stoppedAt: number },
): NextEpisodeResult {
  if (server.type === "continue" && server.episode.Id !== stop.episode.Id) {
    const startedAt = Date.parse(server.episode.UserData?.LastPlayedDate ?? "");
    if (Number.isFinite(startedAt) && startedAt >= stop.stoppedAt - CLOCK_SKEW_MS) return server;
  }
  return { type: "continue", episode: stop.episode, positionTicks: stop.positionTicks };
}
