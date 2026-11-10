import { probeTrailerDecodes, type TrailerCodec } from "@tentacle-tv/shared";

/**
 * Ce que le lecteur de CE navigateur décode, demandé à lui-même
 * (`MediaSource.isTypeSupported`, les types que le relais sert vraiment —
 * `trailerCodecs.ts`). Mesuré le 10/11/2026 : Electron et Chrome lisent tout ;
 * le bureau CEF (Chromium sans codecs propriétaires) refuse `avc1` et `mp4a`
 * et accepte le VP9 et l'Opus en MP4. La réponse est DÉCLARÉE au client d'API
 * (`declareTrailerDecodes`), qui en tire ses requêtes : rien de plus pour qui
 * lit le H.264, `dec=vp9,opus` pour le bureau CEF, aucune requête pour un
 * lecteur qui ne lirait aucun flux du relais.
 *
 * `null` : pas de source média à interroger (un navigateur qui lit le HLS seul,
 * sans MSE) — rien à déclarer, l'élément `<video>` décidera comme avant.
 */
export function probePreviewDecodes(scope: Record<string, unknown> = globalThis as Record<string, unknown>): TrailerCodec[] | null {
  const source = (scope.MediaSource ?? scope.ManagedMediaSource) as { isTypeSupported?: (mimeType: string) => boolean } | undefined;
  if (typeof source?.isTypeSupported !== "function") return null;
  return probeTrailerDecodes((mimeType) => source.isTypeSupported?.(mimeType) === true);
}
