import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildQualityLadder, isPresetOffered, findPreset,
  type MediaSource, type QualityKey,
} from "@tentacle-tv/shared";

/**
 * Gère l'état de qualité côté Android TV : key du preset + dérivation
 * des paramètres à injecter dans l'URL de stream.
 *
 * `quality === "original"` → direct play (sauf forceTranscode codec)
 * Toute autre valeur → transcode avec maxBitrate + maxHeight depuis le preset.
 */
export function useTVPlaybackQuality(mediaSource: MediaSource | null | undefined) {
  const [qualityKey, setQualityKey] = useState<QualityKey>("original");
  // Les paliers dépendent de la source : proposer un transcodage plus lourd
  // que l'original serait absurde (cf. buildQualityLadder).
  const qualityPresets = useMemo(() => buildQualityLadder(mediaSource), [mediaSource]);
  const preset = findPreset(qualityKey, qualityPresets);

  // Garde-fou : un palier proposé sur un média peut disparaître sur le suivant.
  // Retomber sur « Originale » plutôt que de conserver une clé fantôme.
  useEffect(() => {
    if (!isPresetOffered(qualityKey, qualityPresets)) setQualityKey("original");
  }, [qualityPresets, qualityKey]);

  /** True si l'utilisateur a explicitement choisi un preset transcodé. */
  const isTranscodingQuality = qualityKey !== "original";
  const maxBitrate = preset.bitrate ?? undefined;
  const maxHeight = preset.height ?? undefined;
  const maxWidth = preset.width ?? undefined;

  const reset = useCallback(() => setQualityKey("original"), []);

  return {
    qualityKey, setQualityKey, qualityPresets, reset,
    isTranscodingQuality, maxBitrate, maxHeight, maxWidth,
  };
}
