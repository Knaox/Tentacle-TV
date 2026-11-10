/* ------------------------------------------------------------------ */
/*  Le flux servi à CE client : H.264, libre (VP9 + Opus), ou rien     */
/*                                                                     */
/*  Le client déclare ce que son lecteur décode (`dec=`), la règle     */
/*  partagée décide (`trailers/trailerCodecs.ts`) ; ici, ce que le     */
/*  serveur y met de lui : il ne sert le flux libre que s'il DÉCLARE   */
/*  la capacité `trailers.openCodecs` — un serveur d'avant, à qui un   */
/*  client ne l'aurait pas demandé, ne l'improvise pas.                */
/* ------------------------------------------------------------------ */

import { isCapabilityDeclared } from "../../../serverCapabilities/declaredCapabilities";
import { parseTrailerDecodes, TRAILER_DECODES_PARAM, trailerDeliveryFor, type TrailerCodec, type TrailerDelivery } from "../../../trailers/trailerCodecs";
import { openYoutubeRef, type VideoRef } from "../videoRef";

/** Le flux pour ce que le client déclare ; `null` : aucun ne se lirait chez lui. */
export function deliveryFor(decodes: readonly TrailerCodec[] | null | undefined): TrailerDelivery | null {
  return trailerDeliveryFor(decodes ?? null, { openCodecs: isCapabilityDeclared("trailers.openCodecs") });
}

/** Le flux pour une requête de lecture (`/resolve`, `/prepare` : `?dec=vp9,opus`). */
export function deliveryOfQuery(query: Readonly<Record<string, unknown>>): TrailerDelivery | null {
  const raw = query[TRAILER_DECODES_PARAM];
  return deliveryFor(raw === undefined ? null : parseTrailerDecodes(Array.isArray(raw) ? "" : raw));
}

/**
 * La clé du relais pour ce flux : l'entrée LIBRE d'une vidéo YouTube
 * (`o:<id>`) ; `null` pour une vidéo Dailymotion, qui n'existe qu'en H.264 —
 * rien à servir à ce client.
 */
export function refForDelivery(ref: VideoRef, delivery: TrailerDelivery): VideoRef | null {
  if (delivery === "h264") return ref;
  return ref.kind === "youtube" ? openYoutubeRef(ref.id) : null;
}
