import { parseYouTubeId } from "./youtube";
import { sortTrailersByLang, type RichTrailer } from "./trailerLang";

interface JellyfinTrailer {
  Url: string;
  Name?: string;
}

/** Vidéo TMDB renvoyée par la route backend /api/tmdb/trailers. */
export interface TmdbVideo {
  key: string;
  name?: string;
  type?: string;
  site?: string;
  lang?: string;
  url: string;
}

/**
 * Fusionne les trailers Jellyfin (`RemoteTrailers`) et la liste complète TMDB
 * (via Jellyseerr) en dédupliquant par identifiant YouTube. Les entrées TMDB
 * priment (plus riches : type, langue). Le résultat est trié par langue de
 * l'utilisateur puis par type (trailer avant teaser).
 */
export function mergeTrailers(
  jellyfin: JellyfinTrailer[],
  tmdb: TmdbVideo[],
  lang: string | undefined,
): RichTrailer[] {
  const byKey = new Map<string, RichTrailer>();
  const keyOf = (url: string) => parseYouTubeId(url) ?? url;

  for (const j of jellyfin) {
    if (!j.Url) continue;
    const id = keyOf(j.Url);
    if (!byKey.has(id)) byKey.set(id, { Url: j.Url, Name: j.Name });
  }
  for (const v of tmdb) {
    if (!v.url) continue;
    const id = v.key || keyOf(v.url);
    byKey.set(id, { Url: v.url, Name: v.name, type: v.type, lang: v.lang });
  }

  return sortTrailersByLang([...byKey.values()], lang);
}
