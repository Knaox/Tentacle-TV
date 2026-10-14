/**
 * L'adresse de l'écran des bandes-annonces (`/trailer`) — pur.
 *
 * Trois façons d'y entrer, toutes lues dans l'app, sans publicité :
 *  - un titre de la BIBLIOTHÈQUE (film, série, saison, épisode) : son
 *    catalogue, dans l'ordre du serveur (capacité `trailers.catalog`) ;
 *  - un titre TMDB (une carte de Vigie, `openTrailerFor`) : le même catalogue,
 *    hors bibliothèque ;
 *  - UNE vidéo YouTube (serveur d'avant le catalogue, rangée d'extras) : elle
 *    seule, par le relais.
 * `start` désigne la bande-annonce touchée (`yt:<id>`, `dm:<id>`) : la lecture
 * part d'elle si la liste l'a, sinon de la première.
 */

/** Ce que le catalogue sait décrire dans la bibliothèque. */
export type TrailerRouteItemType = "Movie" | "Series" | "Season" | "Episode";

export type TrailerRouteTarget =
  | { kind: "item"; itemId: string; itemType: TrailerRouteItemType }
  | { kind: "tmdb"; tmdbId: number; mediaType: "movie" | "tv"; season?: number }
  | { kind: "youtube"; ytId: string; name?: string };

export interface TrailerRoute {
  target: TrailerRouteTarget;
  start?: string;
}

const ITEM_ID = /^[0-9a-f-]{32,36}$/i;
const ITEM_TYPE = /^(Movie|Series|Season|Episode)$/;
const YT_ID = /^[\w-]{11}$/;
const START = /^(yt|dm):[\w-]{5,16}$/;
const MAX_NAME = 200;

/** Le chemin de l'écran, paramètres compris (à passer à `router.push`). */
export function trailerRouteHref({ target, start }: TrailerRoute): string {
  const params = new URLSearchParams();
  if (target.kind === "item") {
    params.set("itemId", target.itemId);
    params.set("type", target.itemType);
  } else if (target.kind === "tmdb") {
    params.set("tmdbId", String(target.tmdbId));
    params.set("mediaType", target.mediaType);
    if (target.season !== undefined) params.set("season", String(target.season));
  } else {
    params.set("yt", target.ytId);
    if (target.name) params.set("name", target.name.slice(0, MAX_NAME));
  }
  if (start && START.test(start)) params.set("start", start);
  return `/trailer?${params.toString()}`;
}

const text = (value: unknown): string | undefined => {
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === "string" && first !== "" ? first : undefined;
};

/** Les paramètres de la route (expo-router) → la demande ; `null` : rien de lisible, l'écran se ferme. */
export function parseTrailerRoute(params: Readonly<Record<string, unknown>>): TrailerRoute | null {
  const start = text(params.start);
  const withStart = (target: TrailerRouteTarget): TrailerRoute => (start && START.test(start) ? { target, start } : { target });
  const itemId = text(params.itemId);
  const itemType = text(params.type);
  if (itemId && itemType) {
    if (!ITEM_ID.test(itemId) || !ITEM_TYPE.test(itemType)) return null;
    return withStart({ kind: "item", itemId, itemType: itemType as TrailerRouteItemType });
  }
  const tmdbId = Number(text(params.tmdbId));
  const mediaType = text(params.mediaType);
  if (Number.isInteger(tmdbId) && tmdbId > 0 && (mediaType === "movie" || mediaType === "tv")) {
    const season = Number(text(params.season));
    const withSeason = mediaType === "tv" && Number.isInteger(season) && season >= 0 && season < 1000;
    return withStart(withSeason ? { kind: "tmdb", tmdbId, mediaType, season } : { kind: "tmdb", tmdbId, mediaType });
  }
  const ytId = text(params.yt);
  if (ytId && YT_ID.test(ytId)) {
    const name = text(params.name)?.slice(0, MAX_NAME);
    return withStart(name ? { kind: "youtube", ytId, name } : { kind: "youtube", ytId });
  }
  return null;
}
