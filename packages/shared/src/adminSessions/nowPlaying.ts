import type { AdminNowPlayingDto } from "../types/adminSessionsDto";

/**
 * Le nom de ce qui se lit, tel que l'administrateur le lit — UNE règle pour
 * toutes les cartes, toutes les annonces, tous les appareils :
 *
 * - un épisode : « Breaking Bad — S1 E1 · Chute libre » ;
 * - un film, une musique : son titre.
 *
 * Le code d'épisode s'écrit « S1 E1 » : jamais « É », jamais « Épisode » —
 * une lettre qui change selon la langue se lit mal dans un tableau, et
 * Jellyfin, comme les autres lecteurs, l'écrit ainsi.
 */

export interface NowPlayingTitle {
  /** Ce qu'on nomme d'abord : la série d'un épisode, sinon le titre. */
  title: string;
  /** Ce qui suit le tiret pour un épisode : « S1 E1 · Chute libre ». */
  episode: string | null;
  /** En une ligne : « Breaking Bad — S1 E1 · Chute libre », ou le titre seul. */
  full: string;
}

type NowPlayingFields = Pick<AdminNowPlayingDto, "name" | "type" | "seriesName" | "seasonNumber" | "episodeNumber">;

/** « S1 E1 », « S1 », « E5 » — `null` sans numéro. */
export function sessionEpisodeCode(season?: number, episode?: number): string | null {
  const parts = [
    season !== undefined ? `S${season}` : null,
    episode !== undefined ? `E${episode}` : null,
  ].filter((p): p is string => p !== null);
  return parts.length > 0 ? parts.join(" ") : null;
}

/**
 * Le nom générique que Jellyfin donne à un épisode sans métadonnées
 * (« Episode 5 », « Épisode 5 ») ne dit rien de plus que le code : il saute.
 */
const GENERIC_EPISODE_NAME = /^(?:episode|épisode|ep\.?)\s*\d+$/i;

export function nowPlayingTitle(item: NowPlayingFields): NowPlayingTitle {
  const name = item.name.trim();
  const series = item.seriesName?.trim() ?? "";
  if (item.type !== "Episode") return { title: name, episode: null, full: name };

  const code = sessionEpisodeCode(item.seasonNumber, item.episodeNumber);
  const ownName = name !== "" && !(code !== null && GENERIC_EPISODE_NAME.test(name)) ? name : null;
  // Sans série connue, l'épisode se nomme lui-même ; le code le suit.
  if (series === "") {
    const title = ownName ?? code ?? name;
    const episode = ownName !== null ? code : null;
    return { title, episode, full: episode !== null ? `${title} — ${episode}` : title };
  }
  const episode = [code, ownName].filter((p): p is string => p !== null).join(" · ") || null;
  return { title: series, episode, full: episode !== null ? `${series} — ${episode}` : series };
}
