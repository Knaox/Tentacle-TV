import type { PlaybackTier } from "@tentacle-tv/shared";

/**
 * Le niveau de LECTURE de l'appareil (`normal` | `lite`, shared
 * `litePlayback.ts`) — ce que le lecteur lit pour régler ses moteurs (tampon
 * d'Exo, options de mpv, garde du décodeur, plafond de la lecture directe).
 *
 * Ce fichier est celui de l'Apple TV (et le défaut) : TOUJOURS `normal`, rien
 * ne change. Android TV : `playbackTier.android.ts`.
 */
export const PLAYBACK_TIER: PlaybackTier = "normal";

/** Fixe pour la vie du JS (un changement de niveau recharge l'interface) : une constante. */
export function usePlaybackTier(): PlaybackTier {
  return PLAYBACK_TIER;
}
