import { engineTranscodingProfiles, type EngineCapabilities, type TranscodingProfile } from "@tentacle-tv/shared";

/**
 * Les profils de TRANSCODAGE Android (plafond de débit, palier choisi, replis),
 * tirés de ce que lit le moteur (`engineTranscodingProfiles`, shared) :
 * ExoPlayer ou mpv. Le profil du moteur passe EN PREMIER — Jellyfin prend le
 * premier profil vidéo, et un « H.264 seul » placé devant rendait le HEVC
 * inaccessible. mpv y reçoit aussi le son tel quel (DTS, TrueHD).
 */
/** `sourceAudioCodec` : la piste lue — un DTS sous mpv fait passer le profil en fMP4 (cf. shared). */
export function androidTranscodingProfiles(engine: EngineCapabilities, sourceAudioCodec?: string | null): TranscodingProfile[] {
  return engineTranscodingProfiles(engine, { sourceAudioCodec });
}
