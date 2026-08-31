import type { DeviceProfile } from "@tentacle-tv/shared";
import {
  CONDITIONS_HEVC, h264Conditions, MUSIC_BITRATE, AUDIO_PROFILE_6_CHANNELS, AUDIO_ONLY_PROFILE,
  dynamicRangeCondition, hlsFmp4Profile, hlsTsProfile, bitmapSubtitles,
  TEXT_SUBTITLES_HLS, type WebProfileOptions,
} from "./blocks";
import { supportedDynamicRanges } from "./codecs";

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
  options?: WebProfileOptions,
): DeviceProfile {
  return {
    // Plus bas que le profil navigateur (150 Mb/s) : AVFoundation décode en
    // matériel, et la WKWebView n'a pas la marge de hls.js sur les pointes de
    // débit. Reste au-dessus de tout Blu-ray UHD (≈128 Mb/s vidéo), donc ce
    // plafond ne déclenche jamais un transcodage à lui seul.
    MaxStreamingBitrate: maxBitrate ?? 120_000_000,
    MaxStaticBitrate: 150_000_000,
    MusicStreamingTranscodingBitrate: MUSIC_BITRATE,
    DirectPlayProfiles: [
      { Container: "mp4,m4v,mov", Type: "Video",
        VideoCodec: "h264,hevc", AudioCodec: "aac,flac,alac,ac3,eac3,mp3" },
      { Container: "mp3", Type: "Audio" },
      { Container: "aac,m4a", Type: "Audio" },
      { Container: "flac", Type: "Audio" },
    ],
    TranscodingProfiles: [
      // Pas de Dolby en fMP4 : la copie ac3/eac3 y produit, selon
      // l'entrelacement du fichier, un init au moov vide (Jellyfin ne pose pas
      // delay_moov — « Cannot write moov atom before AC3 packets ») et
      // AVFoundation refuse le flux (-16172). Le TS, sans moov, les garde.
      hlsFmp4Profile("hevc,h264", "aac"),
      hlsTsProfile("h264", "aac,ac3,eac3"),
      AUDIO_ONLY_PROFILE,
    ],
    CodecProfiles: [
      { Type: "Video", Codec: "h264", Conditions: h264Conditions("52") },
      { Type: "Video", Codec: "hevc",
        Conditions: [...CONDITIONS_HEVC, dynamicRangeCondition(supportedDynamicRanges())] },
      AUDIO_PROFILE_6_CHANNELS,
    ],
    SubtitleProfiles: [...TEXT_SUBTITLES_HLS, ...bitmapSubtitles(options?.pgsClientUnavailable)],
  };
}
