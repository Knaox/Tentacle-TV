import { useCallback, useState } from "react";
import { findPreset, type QualityKey } from "@tentacle-tv/shared";

/**
 * Gère l'état de qualité côté Android TV : key du preset + dérivation
 * des paramètres à injecter dans l'URL de stream.
 *
 * `quality === "original"` → direct play (sauf forceTranscode codec)
 * Toute autre valeur → transcode avec maxBitrate + maxHeight depuis le preset.
 */
export function useTVPlaybackQuality() {
  const [qualityKey, setQualityKey] = useState<QualityKey>("original");
  const preset = findPreset(qualityKey);

  /** True si l'utilisateur a explicitement choisi un preset transcodé. */
  const isTranscodingQuality = qualityKey !== "original";
  const maxBitrate = preset.bitrate ?? undefined;
  const maxHeight = preset.height ?? undefined;
  const maxWidth = preset.width ?? undefined;

  const reset = useCallback(() => setQualityKey("original"), []);

  return {
    qualityKey, setQualityKey, reset,
    isTranscodingQuality, maxBitrate, maxHeight, maxWidth,
  };
}
