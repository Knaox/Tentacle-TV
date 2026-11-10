import { trailerDecodesParam, trailerDeliveryFor, TRAILER_DECODES_PARAM, type TrailerCodec, type TrailerDelivery } from "@tentacle-tv/shared";
import { useServerCapability } from "../hooks/useServerCapabilities";

/**
 * Ce que le lecteur de CET appareil décode — DÉCLARÉ une fois par la plateforme
 * (le web : `MediaSource.isTypeSupported`, `apps/web/src/trailerPreview/previewDecode.ts`),
 * lu par tout ce qui demande une bande-annonce relayée (aperçu au survol, sa
 * préparation, lecteur de la fiche). La règle est partagée
 * (`@tentacle-tv/shared` › `trailerCodecs`) : H.264 + AAC, le flux de
 * toujours ; VP9 + Opus pour un Chromium sans codecs propriétaires (le bureau
 * CEF), face à un serveur qui déclare `trailers.openCodecs` ; sinon RIEN —
 * aucune requête, aucune erreur.
 *
 * Une plateforme qui ne déclare rien (les téléviseurs, le mobile : AVPlayer,
 * ExoPlayer) garde les requêtes d'avant, sans paramètre.
 */
let declared: readonly TrailerCodec[] | null = null;

/** `null` : rien à dire (pas de sonde ici) — le flux H.264 de toujours. */
export function declareTrailerDecodes(decodes: readonly TrailerCodec[] | null): void {
  declared = decodes;
}

export function declaredTrailerDecodes(): readonly TrailerCodec[] | null {
  return declared;
}

/** Le flux que le relais servirait à ce lecteur ; `null` : aucun ne se lirait — rien à demander. */
export function trailerDeliveryHere(openCodecs: boolean): TrailerDelivery | null {
  return trailerDeliveryFor(declared, { openCodecs });
}

/**
 * Le flux pour ce lecteur face à CE serveur (capacité `trailers.openCodecs`).
 * `null` : rien ne se lirait — l'appelant ne demande rien et ne montre rien.
 */
export function useTrailerDelivery(): TrailerDelivery | null {
  return trailerDeliveryHere(useServerCapability("trailers.openCodecs"));
}

/** Le suffixe d'une requête de lecture (`&dec=vp9,opus`), vide pour un lecteur qui lit le H.264. */
export function trailerDecodesQuery(): string {
  const value = trailerDecodesParam(declared);
  return value === null ? "" : `&${TRAILER_DECODES_PARAM}=${value}`;
}

/** Les codecs à écrire dans un corps de requête, ou `undefined` pour un lecteur qui lit le H.264. */
export function trailerDecodesBody(): readonly TrailerCodec[] | undefined {
  return trailerDecodesParam(declared) === null ? undefined : declared ?? undefined;
}
