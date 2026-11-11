import {
  engineTranscodingProfiles, readableRangeTypes,
  type CodecProfile, type EngineCapabilities, type TranscodingProfile,
} from "@tentacle-tv/shared";
import { dynamicRangeCondition } from "./blocks";

/**
 * Les profils d'un lecteur web SANS codecs propriétaires — le bureau CEF quand
 * mpv ne lit pas et que `<video>` + hls.js prend le relais (`openWebEngine`,
 * packages/shared). Le profil d'un navigateur ordinaire y demandait du H.264 +
 * AAC en TS : `manifestIncompatibleCodecsError`, rien ne jouait (mesuré le
 * 11/11/2026 sur l'instance réelle).
 *
 * - UN profil vidéo, tiré du moteur par la règle partagée : HLS en fMP4, AV1,
 *   le son converti en Opus. Mesuré sur Jellyfin 12.4 : une source AV1 est
 *   copiée, une source H.264 ou HEVC est encodée en AV1 (init `av01` + `Opus`,
 *   premier segment en 0,07 à 0,23 s) ; jamais le VP9 dans la liste (`openWebEngine`).
 *   Mêmes drapeaux que les profils du web (`hlsFmp4Profile`) : un segment
 *   avant le manifeste, jamais de coupe hors image clé.
 * - Les plages de l'AV1 : ce que Chromium ramène à l'écran (HDR10, HLG, un
 *   Dolby Vision par sa base), jamais un Dolby Vision sans base lisible.
 *   « Unknown » y reste : un fichier mal sondé ne perd pas sa copie.
 */
export function openWebProfiles(engine: EngineCapabilities): { transcoding: TranscodingProfile[]; codecs: CodecProfile[] } {
  // `codecs` : les conditions de l'IMAGE seulement — celle du son (6 canaux) est commune à tous les profils du web.
  return {
    transcoding: engineTranscodingProfiles(engine, { minSegments: 1, breakOnNonKeyFrames: false, universalFallback: false }),
    codecs: [{ Type: "Video", Codec: "av1", Conditions: [dynamicRangeCondition(["Unknown", ...readableRangeTypes(engine.hdr)])] }],
  };
}
