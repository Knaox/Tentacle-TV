import type { DeviceProfile } from "@tentacle-tv/shared";
import {
  CONDITIONS_HEVC, conditionsH264, DEBIT_MUSIQUE, PROFIL_AUDIO_6_CANAUX, PROFIL_AUDIO_SEUL,
  conditionPlageDynamique, profilHlsFmp4, profilHlsTs, sousTitresBitmap,
  SOUS_TITRES_TEXTE_HLS, type OptionsProfilWeb,
} from "./blocs";
import { plagesDynamiquesSupportees } from "./codecs";

/**
 * Device profile for macOS Tauri (WKWebView / AVFoundation).
 *
 * WKWebView uses Safari's media engine (AVFoundation) which natively supports:
 * - HEVC hardware decode (including HDR10, Dolby Vision on Apple Silicon)
 * - H.264 up to Level 5.2
 * - FLAC, ALAC, AC3, EAC3 audio
 * - fMP4 HLS segments (required for HEVC HLS — TS segments don't work in Safari)
 *
 * Differences vs browser profile:
 * - HEVC in DirectPlay (mp4/m4v/mov) — Chrome can't do this
 * - HEVC transcoding via fMP4 HLS (not TS)
 * - FLAC, ALAC, AC3, EAC3 in DirectPlay audio
 * - No WebM/VP9 (AVFoundation doesn't support it)
 */
export function buildMacOSDeviceProfile(
  maxBitrate?: number,
  options?: OptionsProfilWeb,
): DeviceProfile {
  return {
    // Plus bas que le profil navigateur (150 Mb/s) : AVFoundation décode en
    // matériel, et la WKWebView n'a pas la marge de hls.js sur les pointes de
    // débit. Reste au-dessus de tout Blu-ray UHD (≈128 Mb/s vidéo), donc ce
    // plafond ne déclenche jamais un transcodage à lui seul.
    MaxStreamingBitrate: maxBitrate ?? 120_000_000,
    MaxStaticBitrate: 150_000_000,
    MusicStreamingTranscodingBitrate: DEBIT_MUSIQUE,
    DirectPlayProfiles: [
      { Container: "mp4,m4v,mov", Type: "Video",
        VideoCodec: "h264,hevc", AudioCodec: "aac,flac,alac,ac3,eac3,mp3" },
      { Container: "mp3", Type: "Audio" },
      { Container: "aac,m4a", Type: "Audio" },
      { Container: "flac", Type: "Audio" },
    ],
    TranscodingProfiles: [
      profilHlsFmp4("hevc,h264", "aac,ac3,eac3"),
      profilHlsTs("h264", "aac,ac3,eac3"),
      PROFIL_AUDIO_SEUL,
    ],
    CodecProfiles: [
      { Type: "Video", Codec: "h264", Conditions: conditionsH264("52") },
      { Type: "Video", Codec: "hevc",
        Conditions: [...CONDITIONS_HEVC, conditionPlageDynamique(plagesDynamiquesSupportees())] },
      PROFIL_AUDIO_6_CANAUX,
    ],
    SubtitleProfiles: [...SOUS_TITRES_TEXTE_HLS, ...sousTitresBitmap(options?.pgsClientIndisponible)],
  };
}
