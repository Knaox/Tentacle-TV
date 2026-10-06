import { engineTranscodingProfiles, type EngineCapabilities, type TranscodingProfile } from "@tentacle-tv/shared";

/**
 * Les profils de TRANSCODAGE iOS, communs aux deux moteurs : ils ne servent
 * que dans la liste fermée des cas où le serveur travaille encore (plafond de
 * débit, palier de qualité choisi, AirPlay, Dolby Vision profil 5, échec des
 * deux lectures directes).
 *
 * Avec AVPlayer, JAMAIS d'ac3/eac3 copié vers le fMP4 : le muxeur de ffmpeg ne
 * connaît les paramètres du codec qu'à l'arrivée des premiers paquets, et
 * Jellyfin ne pose pas `-movflags delay_moov` — l'init sort avec un moov vide
 * et AVPlayer rend CoreMediaErrorDomain -16172 (One Piece S10E12). La règle
 * partagée les retire d'elle-même de tout profil fMP4.
 */
export function iosTranscodingProfiles(engine: EngineCapabilities, sourceAudioCodec?: string | null): TranscodingProfile[] {
  // La règle est dans `engineTranscodingProfiles` (shared) : fMP4 sans AC3 pour
  // AVPlayer, TS avec tout son pour mpv, et le repli H.264 + AAC derrière.
  return engineTranscodingProfiles(engine, { sourceAudioCodec });
}
