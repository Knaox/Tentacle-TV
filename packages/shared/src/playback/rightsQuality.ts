import type { MediaSource } from "../types/media";
import type { QualityPreset } from "../utils/mediaQuality";
import { bestTierForBudget, buildQualityLadder } from "../utils/qualityLadder";
import type { PlaybackRights } from "./playbackRights";

/**
 * L'échelle de qualité face aux droits de lecture du compte
 * (docs/DROITS-UTILISATEURS.md § 9.2) — la même règle pour le web, le bureau et
 * les téléviseurs :
 *
 * - un palier RÉENCODE l'image : sans ce droit, le menu n'offre que
 *   « Originale » ;
 * - le plafond d'un client distant borne le menu, et impose un palier dès que
 *   la source le dépasse — même en « Originale » choisie à la main : c'est la
 *   règle du serveur, pas une préférence qu'on désarme.
 */

/** Les paliers que le compte peut demander, dans l'ordre reçu. */
export function offeredQualityPresets(presets: readonly QualityPreset[], rights: PlaybackRights): QualityPreset[] {
  if (!rights.videoTranscoding) return presets.filter((preset) => preset.bitrate == null);
  const cap = rights.maxBitrate;
  return cap === null ? [...presets] : presets.filter((preset) => preset.bitrate == null || preset.bitrate <= cap);
}

/** Le débit total de la source (conteneur, sinon piste vidéo) ; `null` : inconnu. */
export function sourceTotalBitrate(source: MediaSource | null | undefined): number | null {
  const total = source?.Bitrate ?? source?.MediaStreams?.find((stream) => stream.Type === "Video")?.BitRate;
  return total && total > 0 ? total : null;
}

/**
 * Le palier qu'impose le plafond de ce client : `null` sans plafond, sans
 * droit de réencoder (la lecture se juge alors à part, `exceedsBitrateCap`),
 * ou quand la source tient dessous. Rien ne tient : le palier le plus bas,
 * que le serveur borne de toute façon.
 */
export function rightsCapTier(source: MediaSource | null | undefined, rights: PlaybackRights): QualityPreset | null {
  const cap = rights.maxBitrate;
  const total = sourceTotalBitrate(source);
  if (cap === null || !rights.videoTranscoding || total === null || total <= cap) return null;
  const tiers = buildQualityLadder(source).filter((preset) => preset.bitrate != null);
  return bestTierForBudget(source, cap) ?? tiers[tiers.length - 1] ?? null;
}

/** Le fichier tel quel dépasse le plafond de ce client (le lire exigerait de le réencoder). */
export function exceedsBitrateCap(source: MediaSource | null | undefined, rights: PlaybackRights): boolean {
  const total = sourceTotalBitrate(source);
  return rights.maxBitrate !== null && total !== null && total > rights.maxBitrate;
}

/** Le palier le plus léger des deux (`null` : aucun). */
export function lighterPreset(a: QualityPreset | null, b: QualityPreset | null): QualityPreset | null {
  if (!a || a.bitrate == null) return b;
  if (!b || b.bitrate == null) return a;
  return a.bitrate <= b.bitrate ? a : b;
}
