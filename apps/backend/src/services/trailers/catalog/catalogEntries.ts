/* ------------------------------------------------------------------ */
/*  Ce que chaque source rend, en entrées du catalogue — pur            */
/*                                                                     */
/*  La version se décide d'après la langue du SERVEUR                  */
/*  (`trailerVersionOf`, la règle de la liste) ; le type d'après TMDB  */
/*  ou le libellé (`trailerKind`) — ce qui n'est ni une bande-annonce  */
/*  ni un teaser (featurette, extrait, coulisses) n'entre pas.         */
/* ------------------------------------------------------------------ */

import { parseYouTubeId, trailerKind, type JellyfinTrailer, type TmdbVideo } from "../../../trailers/trailerList";
import type { TrailerEntry, TrailerScope, TrailerSource, TrailerVersion } from "../../../trailers/trailerCatalog";
import { trailerVersionOf } from "../../../trailers/trailerCatalogRank";
import type { AllocineMatch } from "../allocine/allocineMatch";
import type { AllocineVersion } from "../allocine/allocineTitle";
import type { LocalTrailer } from "./catalogTitle";

/** Les vidéos YouTube d'une source (TMDB, Jellyseerr, Jellyfin) pour une portée. */
export function youtubeEntries(
  videos: readonly TmdbVideo[],
  scope: TrailerScope,
  source: Extract<TrailerSource, "tmdb" | "seerr" | "jellyfin">,
  serverLang: string | null,
): TrailerEntry[] {
  const entries: TrailerEntry[] = [];
  for (const video of videos) {
    const ytId = video.key && /^[\w-]{11}$/.test(video.key) ? video.key : parseYouTubeId(video.url);
    if (!ytId) continue;
    const kind = trailerKind({ Url: video.url, Name: video.name, type: video.type });
    if (kind === "other") continue;
    entries.push({
      scope,
      playback: { kind: "youtube", ytId },
      name: video.name ?? "",
      version: trailerVersionOf({ name: video.name, lang: video.lang }, serverLang),
      type: kind,
      source,
    });
  }
  return entries;
}

/** Les `RemoteTrailers` de Jellyfin (sans type ni langue) : du film ou de la série. */
export function jellyfinRemoteEntries(trailers: readonly JellyfinTrailer[], scope: TrailerScope, serverLang: string | null): TrailerEntry[] {
  return youtubeEntries(trailers.map((t) => ({ key: "", url: t.Url, name: t.Name })), scope, "jellyfin", serverLang);
}

/** Les bandes-annonces locales : un fichier que l'administrateur a posé — toujours en tête de sa portée. */
export function localEntries(trailers: readonly LocalTrailer[], serverLang: string | null): TrailerEntry[] {
  return trailers.map((trailer) => ({
    scope: trailer.scope,
    playback: { kind: "jellyfin", itemId: trailer.itemId },
    name: trailer.name,
    version: trailerVersionOf({ name: trailer.name }, serverLang),
    type: trailerKind({ Url: "", Name: trailer.name }) === "teaser" ? "teaser" : "trailer",
    source: "local",
  }));
}

const ALLOCINE_VERSION: Record<AllocineVersion, TrailerVersion> = { vf: "localized", vostfr: "subtitled", vo: "original" };

/** Les vidéos AlloCiné retenues (un serveur français seulement : leurs versions sont françaises). */
export function allocineEntries(matches: readonly AllocineMatch[]): TrailerEntry[] {
  return matches.map((match) => ({
    scope: match.scope,
    playback: { kind: "dailymotion", videoId: match.videoId },
    name: match.name,
    version: ALLOCINE_VERSION[match.version],
    type: match.kind,
    source: "allocine",
  }));
}
