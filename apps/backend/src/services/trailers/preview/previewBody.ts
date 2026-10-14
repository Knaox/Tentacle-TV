/* ------------------------------------------------------------------ */
/*  Le corps 200 d'un aperçu — le même pour `GET /preview` et pour les  */
/*  aperçus déjà prêts que rend la préparation (`POST /preview/warm`)  */
/* ------------------------------------------------------------------ */

import type { TrailerVersion } from "../../../trailers/trailerCatalog";
import type { TrailerPreview } from "../../../trailers/trailerPreview";
import { relayedStream } from "../relayPaths";
import type { ResolvedTrailer } from "../trailerRelay";
import { parseVideoRef } from "../videoRef";

/** La vidéo retenue (`ref`, sa clé du relais) et son flux relayé, sous un jeton d'aperçu. */
export function previewBody(ref: string, resolved: ResolvedTrailer, version?: TrailerVersion, now = Date.now()): TrailerPreview {
  // Un jeton d'aperçu : la vidéo que le relais oubliera ne se ré-extrait pas hors des garde-fous de la route.
  const stream = relayedStream(ref, resolved, now, "preview");
  const video = parseVideoRef(ref);
  return {
    // Une vidéo Dailymotion n'a pas d'identifiant YouTube : `source` la dit (le client l'a demandée, `dm=1`).
    ytId: video?.kind === "youtube" ? video.id : "",
    source: video?.kind === "dailymotion" ? { kind: "dailymotion", videoId: video.id } : { kind: "youtube", ytId: video?.id ?? ref },
    ...(version ? { version } : {}),
    path: stream.path,
    mimeType: stream.mimeType,
    expiresAt: stream.expiresAt,
    heights: resolved.heights,
    qualities: stream.qualities,
  };
}
