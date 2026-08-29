import type { MediaItem, UserItemData } from "./types/media";
import { TICKS_PER_SECOND } from "./constants";
import { formatEpisodeCode } from "./utils/episodeCode";

/** Watch state for a single media item. */
export type WatchStatus = "unwatched" | "in_progress" | "watched";

/** Result of the getNextEpisode algorithm for a series. */
export type NextEpisodeResult =
  | { type: "completed" }
  | { type: "start"; episode: MediaItem }
  | { type: "continue"; episode: MediaItem; positionTicks: number }
  | { type: "next"; episode: MediaItem };

/** Determine the watch status of a single item. */
export function getWatchStatus(userData?: UserItemData): WatchStatus {
  if (!userData) return "unwatched";
  if (userData.Played) return "watched";
  if (userData.PlaybackPositionTicks > 0) return "in_progress";
  return "unwatched";
}

/** Get playback progress as 0-100 percentage. */
export function getProgressPercent(item: MediaItem): number {
  const position = item.UserData?.PlaybackPositionTicks ?? 0;
  const duration = item.RunTimeTicks ?? 0;
  if (duration <= 0 || position <= 0) return 0;
  return Math.min(100, Math.round((position / duration) * 100));
}

/** Format ticks to HH:MM:SS or MM:SS string. */
export function formatPosition(ticks: number): string {
  const totalSeconds = Math.floor(ticks / TICKS_PER_SECOND);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * L'épisode suivant d'une série — le successeur de celui qu'on vient de
 * REGARDER, jamais le premier trou.
 *
 * L'algorithme cherchait le premier épisode non terminé. C'est faux dès qu'on
 * ne regarde pas dans l'ordre : commencer une saison par son épisode 6 et le
 * finir renvoyait « suivant : épisode 1 », parce que 1 à 5 restent des trous.
 * Et remettre un épisode en « non lu » le faisait réapparaître comme suivant,
 * pour la même raison. L'ancre est désormais la dernière LECTURE, qui est ce
 * que l'utilisateur a effectivement en tête.
 *
 * La liste DOIT être triée par saison (`ParentIndexNumber`) puis épisode
 * (`IndexNumber`) — le successeur est pris à l'index, il traverse donc les
 * saisons : le dernier épisode d'une saison enchaîne sur le premier de la
 * suivante.
 *
 * Les règles, dans l'ordre :
 * 1. un épisode EN COURS (position > 0, non terminé) → le reprendre. Le plus
 *    récent gagne si plusieurs le sont ;
 * 2. sinon, l'épisode joué le plus récemment (`LastPlayedDate`) → son
 *    successeur. Pas de successeur → série terminée ;
 * 3. rien n'a jamais été joué → commencer par le premier ;
 * 4. des lectures existent mais aucune date (serveur qui ne la sert pas) →
 *    repli sur le DERNIER épisode terminé dans l'ordre, qui est la meilleure
 *    approximation disponible de « le plus récent ».
 */
export function getNextEpisode(episodes: MediaItem[]): NextEpisodeResult {
  if (episodes.length === 0) return { type: "completed" };

  const played = (ep: MediaItem): boolean => ep.UserData?.Played === true;
  const position = (ep: MediaItem): number => ep.UserData?.PlaybackPositionTicks ?? 0;
  const playedAt = (ep: MediaItem): number => {
    const raw = ep.UserData?.LastPlayedDate;
    if (!raw) return 0;
    const time = Date.parse(raw);
    return Number.isNaN(time) ? 0 : time;
  };

  // 1. Une lecture entamée l'emporte : c'est là qu'on s'est arrêté.
  const started = episodes.filter((ep) => !played(ep) && position(ep) > 0);
  if (started.length > 0) {
    const episode = mostRecent(started, playedAt);
    return { type: "continue", episode, positionTicks: position(episode) };
  }

  // 2. Le dernier épisode terminé — par date, ou à défaut par l'ordre.
  const finished = episodes.filter(played);
  if (finished.length === 0) return { type: "start", episode: episodes[0] };

  const anchor = finished.some((ep) => playedAt(ep) > 0)
    ? mostRecent(finished, playedAt)
    : finished[finished.length - 1];

  const nextIndex = episodes.indexOf(anchor) + 1;
  if (nextIndex >= episodes.length) return { type: "completed" };
  return { type: "next", episode: episodes[nextIndex] };
}

/**
 * Le plus récent d'une liste non vide, l'ordre de la série départageant les
 * ex æquo — deux épisodes sans date, ou marqués vus d'un même geste, doivent
 * rendre un verdict stable et non le hasard du tri.
 */
function mostRecent(list: MediaItem[], at: (ep: MediaItem) => number): MediaItem {
  return list.reduce((best, ep) => (at(ep) >= at(best) ? ep : best));
}

/** Get display text for the next episode result (French). */
export function getNextEpisodeLabel(result: NextEpisodeResult): string | null {
  if (result.type === "completed") return null;
  const ep = result.episode;
  const num = formatEpisodeCode(ep.ParentIndexNumber, ep.IndexNumber, { style: "padded" });

  switch (result.type) {
    case "start":
      return `Commencer ${num}`;
    case "continue":
      return `Continuer ${num} — ${formatPosition(result.positionTicks)}`;
    case "next":
      return `Episode suivant : ${num}`;
  }
}
