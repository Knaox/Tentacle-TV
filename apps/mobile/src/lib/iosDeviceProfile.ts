import type {
  DeviceProfile,
  DirectPlayProfile,
  CodecProfile,
  SubtitleProfile,
} from "@tentacle-tv/shared";
import { IOS_NATIVE_SUPPORT, supportList } from "@tentacle-tv/offline-core";
import type { PlayerEngineKind } from "@/player/engine/types";
import { buildIosMpvDeviceProfile } from "./iosMpvDeviceProfile";
import { iosTranscodingProfiles } from "./iosTranscodingProfiles";

/**
 * DeviceProfile iOS, par MOTEUR : le lecteur système (AVPlayer via
 * react-native-video) ou le lecteur avancé (libmpv, `iosMpvDeviceProfile.ts`).
 * Le routeur choisit le moteur avant PlaybackInfo ; le profil envoyé à
 * Jellyfin est celui du moteur qui lira.
 *
 * Profil natif : les chaînes DirectPlay viennent de `IOS_NATIVE_SUPPORT`, la
 * même source qui dit ce que le lecteur système lit tel quel.
 *
 * AVPlayer supporte nativement :
 * - Vidéo : H.264 (AVC), HEVC (H.265) ; AV1 sur A17 Pro et plus (`av1Hardware`)
 * - Audio : AAC, FLAC, AC3, EAC3, ALAC, MP3
 * - Containers : MP4, MOV, HLS (fMP4/TS)
 * - PAS de MKV, AVI, WMV, DTS, TrueHD
 *
 * Sans ce profil, Jellyfin tente du direct play sur des MKV
 * → écran noir car AVPlayer ne lit pas ce container.
 */
export function buildIosDeviceProfile(
  engine: PlayerEngineKind,
  maxBitrate?: number,
  options: { av1Hardware?: boolean } = {},
): DeviceProfile {
  if (engine === "mpv") return buildIosMpvDeviceProfile(maxBitrate);

  const directPlayProfiles: DirectPlayProfile[] = [
    {
      Container: supportList(IOS_NATIVE_SUPPORT.containers),
      Type: "Video",
      VideoCodec: supportList(IOS_NATIVE_SUPPORT.videoCodecs) + (options.av1Hardware ? ",av1" : ""),
      AudioCodec: supportList(IOS_NATIVE_SUPPORT.audioCodecs),
    },
    // Audio-only
    { Container: "mp3", Type: "Audio" },
    { Container: "aac,m4a", Type: "Audio" },
    { Container: "flac", Type: "Audio" },
    { Container: "alac", Type: "Audio" },
  ];

  const codecProfiles: CodecProfile[] = [
    // H264 : max level 5.2 (iPhone 6s+), ref frames 16
    {
      Type: "Video",
      Codec: "h264",
      Conditions: [
        { Condition: "LessThanEqual", Property: "VideoLevel", Value: "52", IsRequired: false },
        { Condition: "LessThanEqual", Property: "RefFrames", Value: "16", IsRequired: false },
      ],
    },
    // HEVC : max level 6.1 (A12+), ref frames 16
    {
      Type: "Video",
      Codec: "hevc",
      Conditions: [
        { Condition: "LessThanEqual", Property: "VideoLevel", Value: "183", IsRequired: false },
        { Condition: "LessThanEqual", Property: "RefFrames", Value: "16", IsRequired: false },
      ],
    },
    // Audio : max 6 channels (5.1) — AVPlayer gère 7.1 mais passthrough seulement
    {
      Type: "VideoAudio",
      Conditions: [
        { Condition: "LessThanEqual", Property: "AudioChannels", Value: "6", IsRequired: false },
      ],
    },
  ];

  const subtitleProfiles: SubtitleProfile[] = [
    // Text subs — External for direct play (sideloaded VTT),
    // Hls for transcode (server embeds WebVTT in HLS manifest, native AVPlayer reads them)
    { Format: "vtt", Method: "External" },
    { Format: "vtt", Method: "Hls" },
    { Format: "srt", Method: "External" },
    { Format: "srt", Method: "Hls" },
    { Format: "subrip", Method: "External" },
    { Format: "subrip", Method: "Hls" },
    { Format: "ass", Method: "External" },
    { Format: "ass", Method: "Hls" },
    { Format: "ssa", Method: "External" },
    { Format: "ssa", Method: "Hls" },
    // Bitmap — doivent être gravés par le serveur
    { Format: "pgssub", Method: "Encode" },
    { Format: "dvdsub", Method: "Encode" },
    { Format: "dvbsub", Method: "Encode" },
  ];

  return {
    MaxStreamingBitrate: maxBitrate ?? 120_000_000,
    MaxStaticBitrate: 120_000_000,
    MusicStreamingTranscodingBitrate: 384_000,
    DirectPlayProfiles: directPlayProfiles,
    TranscodingProfiles: iosTranscodingProfiles(),
    CodecProfiles: codecProfiles,
    SubtitleProfiles: subtitleProfiles,
  };
}
