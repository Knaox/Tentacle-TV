import type { PlaybackTier } from "@tentacle-tv/shared";
import { RENDER_TIER } from "../platform/renderTier";

/**
 * Le niveau de lecture sur Android TV — le jumeau de `playbackTier.ts`, aux
 * MÊMES noms. Il SUIT le niveau de rendu de l'appareil (`platform/renderTier`,
 * tv-core `device/renderTier`) : une seule décision, prise avant la première
 * image — signaux, micro-test, réglage « Mode Lite », et le forçage du banc
 * (`adb shell setprop debug.tentacle.lite 1|0`) compris.
 */
export const PLAYBACK_TIER: PlaybackTier = RENDER_TIER;

export function usePlaybackTier(): PlaybackTier {
  return PLAYBACK_TIER;
}
