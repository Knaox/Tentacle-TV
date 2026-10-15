import { useCallback, useEffect, useMemo, useState } from "react";
import { usePlaybackRights } from "@tentacle-tv/api-client";
import {
  buildQualityLadder, isPresetOffered, findPreset, lighterPreset, offeredQualityPresets, rightsCapTier, upfrontRefusal,
  type MediaSource, type QualityKey,
} from "@tentacle-tv/shared";

/**
 * Gère l'état de qualité côté Android TV : key du preset + dérivation
 * des paramètres à injecter dans l'URL de stream.
 *
 * `quality === "original"` → direct play (sauf forceTranscode codec)
 * Toute autre valeur → transcode avec maxBitrate + maxHeight depuis le preset.
 *
 * Les droits de lecture du compte (docs/DROITS-UTILISATEURS.md § 9.2) bornent
 * l'échelle — aucun palier sans le droit de réencoder, aucun au-dessus du
 * plafond d'un client distant — et imposent un palier quand la source dépasse
 * ce plafond, même en « Originale » (shared `rightsQuality`).
 */
export function useTVPlaybackQuality(mediaSource: MediaSource | null | undefined) {
  const [qualityKey, setQualityKey] = useState<QualityKey>("original");
  const { rights, settled: rightsSettled } = usePlaybackRights();
  // Les paliers dépendent de la source : proposer un transcodage plus lourd
  // que l'original serait absurde (cf. buildQualityLadder).
  const qualityPresets = useMemo(() => offeredQualityPresets(buildQualityLadder(mediaSource), rights), [mediaSource, rights]);
  const chosen = findPreset(qualityKey, qualityPresets);
  const capTier = rightsCapTier(mediaSource, rights);
  const preset = capTier ? lighterPreset(chosen, capTier) ?? chosen : chosen;

  // Garde-fou : un palier proposé sur un média peut disparaître sur le suivant.
  // Retomber sur « Originale » plutôt que de conserver une clé fantôme.
  useEffect(() => {
    if (!isPresetOffered(qualityKey, qualityPresets)) setQualityKey("original");
  }, [qualityPresets, qualityKey]);

  /** True si un palier transcodé s'applique (choisi, ou imposé par le plafond). */
  const isTranscodingQuality = preset.bitrate != null;
  const maxBitrate = preset.bitrate ?? undefined;
  const maxHeight = preset.height ?? undefined;
  const maxWidth = preset.width ?? undefined;
  /** La clé que le menu coche : le palier réellement servi. */
  const displayKey = preset !== chosen ? preset.key : qualityKey;
  /** Ce que la fiche suffit à refuser (lecture interdite, plafond sans droit de réencoder). */
  const refusal = rightsSettled ? upfrontRefusal(rights, mediaSource) : null;

  const reset = useCallback(() => setQualityKey("original"), []);

  return {
    qualityKey, setQualityKey, qualityPresets, reset, displayKey,
    isTranscodingQuality, maxBitrate, maxHeight, maxWidth,
    rights, rightsSettled, refusal,
  };
}
