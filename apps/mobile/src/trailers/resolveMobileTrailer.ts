import { fetchTrailerResolve } from "@tentacle-tv/api-client";
import type { RelayedTrailerPlayback, TrailerStream } from "@tentacle-tv/shared";
import { resolveDailymotionDirect } from "./dailymotionDirect";

/**
 * Ce que l'écran des bandes-annonces lit pour une vidéo :
 *  - Dailymotion (AlloCiné) : le téléphone résout lui-même le flux sans
 *    publicité (`dailymotionDirect.ts`) ; s'il n'y arrive pas, le relais du
 *    serveur (`/resolve?dmId=`) ;
 *  - YouTube : TOUJOURS le relais (`/resolve?ytId=`) — l'extraction demande
 *    yt-dlp, que seul le serveur a. Le serveur qui ne peut pas extraire en ce
 *    moment répond `embed` : l'écran confie alors CETTE vidéo à l'app YouTube.
 * Un refus n'est jamais une erreur : c'est un geste (`trailerFailureStep`).
 */
export type MobileTrailerResult =
  | { status: "ready"; stream: TrailerStream }
  | { status: "embed" }
  | { status: "unavailable" }
  | { status: "failed" };

/** Un flux lu directement chez Dailymotion : ni qualité imposée ni sous-titres (le maître « Auto » s'adapte). */
function directStream(url: string): TrailerStream {
  return { url, type: "m3u8", qualities: [], subtitles: [] };
}

export async function resolveMobileTrailer(playback: RelayedTrailerPlayback, serverUrl: string): Promise<MobileTrailerResult> {
  if (playback.kind === "dailymotion") {
    const direct = await resolveDailymotionDirect(playback.videoId);
    if (direct) return { status: "ready", stream: directStream(direct) };
  }
  if (!serverUrl) return { status: "failed" };
  return fetchTrailerResolve(playback, serverUrl);
}
