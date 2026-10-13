/* ------------------------------------------------------------------ */
/*  Les chemins relayés d'une bande-annonce résolue                    */
/*                                                                     */
/*  Ce que `/resolve` (téléviseurs) et `/preview` (aperçu au survol)   */
/*  rendent pour la même vidéo : le maître HLS ou le MP4 servis par CE */
/*  serveur, un maître réduit par hauteur, le tout sous un jeton qui   */
/*  ouvre CETTE vidéo seulement (relayToken.ts). Jamais une URL        */
/*  googlevideo : elles sont liées à l'adresse IP de l'extraction.     */
/* ------------------------------------------------------------------ */

import { RELAY_TOKEN_TTL_MS, signRelayToken } from "./relayToken";
import type { ResolvedTrailer } from "./trailerRelay";

export const HLS_MIME = "application/vnd.apple.mpegurl";
export const MP4_MIME = "video/mp4";

export interface RelayedStream {
  /** Le jeton des chemins, pour qui en relaie d'autres (sous-titres). */
  token: string;
  path: string;
  mimeType: typeof HLS_MIME | typeof MP4_MIME;
  /** Un maître réduit à chaque hauteur, la plus haute en tête ; vide pour un MP4. */
  qualities: Array<{ height: number; path: string }>;
  /** L'échéance des chemins : celle des URL amont, au plus celle du jeton. */
  expiresAt: number;
}

export function relayedStream(ytId: string, resolved: ResolvedTrailer, now = Date.now()): RelayedStream {
  const token = signRelayToken(ytId, now);
  const hls = resolved.kind === "hls";
  return {
    token,
    path: hls ? `/api/trailers/hls/${ytId}/master.m3u8?t=${token}` : `/api/trailers/file/${ytId}.mp4?t=${token}`,
    mimeType: hls ? HLS_MIME : MP4_MIME,
    qualities: resolved.heights.map((height) => ({ height, path: `/api/trailers/hls/${ytId}/master-${height}.m3u8?t=${token}` })),
    // Le jeton est signé à la seconde près, tronquée : une seconde de marge.
    expiresAt: Math.min(resolved.validUntil, now + RELAY_TOKEN_TTL_MS - 1000),
  };
}
