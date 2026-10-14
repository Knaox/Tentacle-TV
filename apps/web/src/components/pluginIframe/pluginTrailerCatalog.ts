import {
  readTrailerCatalog, trailerCatalogPath, trailerPlaybackKey, trailerQueueOf, type TrailerQueueItem,
} from "@tentacle-tv/shared";
import { tentacleApiFetch } from "@tentacle-tv/api-client";

/**
 * Le lecteur COMPLET des bandes-annonces, ouvert par une EXTENSION : elle dit
 * QUEL titre (TMDB, saison facultative), l'hôte demande le catalogue au
 * serveur et ouvre son lecteur — même ordre, zéro publicité, même repli que
 * ses propres fiches. Le cadre de l'extension ne peut pas l'ouvrir lui-même :
 * sa sandbox interdit l'iframe de YouTube, et sur le bureau sa CSP refuse tout
 * `frame-src` — le repli ne peut vivre QUE dans l'hôte.
 *
 * `__tentacle_env.trailerCatalog` dit à l'extension que l'hôte sait le faire
 * (lecteur présent dans ce build ET capacité `trailers.catalog` du serveur) ;
 * sinon elle garde l'ancien `openTrailer`.
 *
 * ⚠️ API PUBLIQUE des extensions : le nom du message, de la méthode du pont
 * (`openTrailerFor`) et des champs ne se renomment jamais.
 */

export const OPEN_TRAILER_CATALOG_MESSAGE = "OPEN_TRAILER_CATALOG";

export interface PluginTrailerCatalogQuery {
  tmdbId: number;
  mediaType: "movie" | "tv";
  season?: number;
  /** Le titre, pour les journaux et l'accessibilité ; facultatif. */
  title?: string;
  /** La bande-annonce cliquée (`yt:<id>`, `dm:<id>`) : la lecture part d'elle si le catalogue l'a. */
  start?: string;
}

/** Le message de l'extension (non typé) → la demande, ou `null` s'il est invalide (ignoré). */
export function parsePluginTrailerCatalogQuery(data: unknown): PluginTrailerCatalogQuery | null {
  if (!data || typeof data !== "object") return null;
  const raw = data as Record<string, unknown>;
  const tmdbId = typeof raw.tmdbId === "number" ? raw.tmdbId : typeof raw.tmdbId === "string" ? Number(raw.tmdbId) : NaN;
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) return null;
  if (raw.mediaType !== "movie" && raw.mediaType !== "tv") return null;
  const query: PluginTrailerCatalogQuery = { tmdbId, mediaType: raw.mediaType };
  if (raw.mediaType === "tv" && typeof raw.season === "number" && Number.isInteger(raw.season) && raw.season >= 0 && raw.season < 1000) {
    query.season = raw.season;
  }
  if (typeof raw.title === "string") query.title = raw.title.slice(0, 200);
  if (typeof raw.start === "string" && /^(yt|dm):[\w-]{5,16}$/.test(raw.start)) query.start = raw.start;
  return query;
}

export interface PluginTrailerQueue {
  queue: TrailerQueueItem[];
  start: number;
  language: string | null;
}

/** Le catalogue du titre, prêt pour le lecteur ; `null` sans rien à lire (ou serveur muet). */
export async function loadPluginTrailerQueue(query: PluginTrailerCatalogQuery, lang: string): Promise<PluginTrailerQueue | null> {
  const path = trailerCatalogPath({ tmdbId: query.tmdbId, mediaType: query.mediaType, season: query.season, lang });
  if (!path) return null;
  try {
    const catalog = readTrailerCatalog(await tentacleApiFetch<unknown>(path));
    const queue = catalog ? trailerQueueOf(catalog.entries) : [];
    if (!catalog || queue.length === 0) return null;
    const start = query.start ? queue.findIndex((item) => trailerPlaybackKey(item.playback) === query.start) : -1;
    return { queue, start: Math.max(0, start), language: catalog.language };
  } catch {
    return null;
  }
}

/** Script du pont (méthode de `__tentacle_bridge`, sans virgule finale) : ouvrir le lecteur de l'hôte sur un titre. */
export function buildTrailerCatalogBridgeMethod(): string {
  return `
      // Le lecteur complet des bandes-annonces de l'HÔTE, sur le catalogue du
      // serveur pour ce titre (__tentacle_env.trailerCatalog le dit possible).
      openTrailerFor: function(query) {
        var q = query || {};
        parent.postMessage({ type: ${JSON.stringify(OPEN_TRAILER_CATALOG_MESSAGE)}, tmdbId: q.tmdbId, mediaType: q.mediaType,
          season: q.season, title: q.title, start: q.start }, "*");
      }`;
}
