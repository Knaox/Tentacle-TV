import { NativeModules } from "react-native";
import type { PlaybackTier } from "@tentacle-tv/shared";

/**
 * Le niveau de lecture sur Android TV — le jumeau de `playbackTier.ts`, aux
 * MÊMES noms.
 *
 * Il DOIT suivre le niveau de rendu de l'appareil (tâche L2, `platform/
 * renderTier` → `RENDER_TIER`) : une seule décision, prise avant la première
 * image. Tant que L2 n'est pas fusionnée, seul le banc force le Lite, par la
 * même propriété (`adb shell setprop debug.tentacle.lite 1`, app de mesure ou
 * construction de développement — `MediaCapabilitiesModule.getConstants`) ;
 * sinon `normal`, le lecteur d'avant. À la fusion : `PLAYBACK_TIER =
 * RENDER_TIER`, rien d'autre ne change.
 */
const forced: unknown = NativeModules.TentacleMediaCapabilities?.liteOverride;

export const PLAYBACK_TIER: PlaybackTier = forced === "1" ? "lite" : "normal";

export function usePlaybackTier(): PlaybackTier {
  return PLAYBACK_TIER;
}
