import type {
  DeviceProfile,
  DirectPlayProfile,
  CodecProfile,
  SubtitleProfile,
} from "@tentacle-tv/shared";
import { ANDROID_NATIVE_SUPPORT, supportList } from "@tentacle-tv/offline-core";
import type { PlayerEngineKind } from "@/player/engine/types";
import { buildAndroidMpvDeviceProfile } from "./androidMpvDeviceProfile";
import { androidTranscodingProfiles } from "./androidTranscodingProfiles";

/**
 * DeviceProfile Android, par MOTEUR : le lecteur système (ExoPlayer via
 * react-native-video) ou le lecteur avancé (libmpv, `androidMpvDeviceProfile.ts`).
 *
 * Profil natif : les chaînes DirectPlay viennent de `ANDROID_NATIVE_SUPPORT`,
 * la même source qui dit ce que le lecteur système lit tel quel.
 *
 * ExoPlayer supporte nativement :
 * - Vidéo : H.264 (AVC), HEVC (H.265), VP9
 * - Audio : AAC, MP3, FLAC, Opus, Vorbis, AC3, EAC3
 * - Containers : MP4, MKV, WebM, HLS (TS/fMP4)
 * - PAS de AVI, WMV, DTS, TrueHD (sans extensions)
 *
 * Différences clés vs iOS AVPlayer :
 * - MKV supporté en direct play (très courant dans Jellyfin)
 * - VP9/WebM supporté
 * - Transcode HLS TS préféré (fMP4 HLS peut poser problème sur certains devices)
 * - Niveaux codec plus conservateurs (mid-range Android)
 */
export function buildAndroidDeviceProfile(engine: PlayerEngineKind, maxBitrate?: number): DeviceProfile {
  if (engine === "mpv") return buildAndroidMpvDeviceProfile(maxBitrate);

  const directPlayProfiles: DirectPlayProfile[] = [
    {
      Container: supportList(ANDROID_NATIVE_SUPPORT.containers),
      Type: "Video",
      VideoCodec: supportList(ANDROID_NATIVE_SUPPORT.videoCodecs),
      AudioCodec: supportList(ANDROID_NATIVE_SUPPORT.audioCodecs),
    },
    // Audio-only
    { Container: "mp3", Type: "Audio" },
    { Container: "aac,m4a", Type: "Audio" },
    { Container: "flac", Type: "Audio" },
    { Container: "ogg,webm", Type: "Audio" },
  ];

  const codecProfiles: CodecProfile[] = [
    // H264 : max level 5.1 (plus conservateur qu'iOS — meilleure compatibilité Android)
    {
      Type: "Video",
      Codec: "h264",
      Conditions: [
        { Condition: "LessThanEqual", Property: "VideoLevel", Value: "51", IsRequired: false },
        { Condition: "LessThanEqual", Property: "RefFrames", Value: "16", IsRequired: false },
      ],
    },
    // HEVC : max level 5.1 / 153 (mid-range Android, pas 6.1 comme iOS)
    {
      Type: "Video",
      Codec: "hevc",
      Conditions: [
        { Condition: "LessThanEqual", Property: "VideoLevel", Value: "153", IsRequired: false },
        { Condition: "LessThanEqual", Property: "RefFrames", Value: "16", IsRequired: false },
      ],
    },
    // Audio : max 6 channels (5.1)
    {
      Type: "VideoAudio",
      Conditions: [
        { Condition: "LessThanEqual", Property: "AudioChannels", Value: "6", IsRequired: false },
      ],
    },
  ];

  const subtitleProfiles: SubtitleProfile[] = [
    // Text subs — External pour direct play, Hls pour transcode
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
    TranscodingProfiles: androidTranscodingProfiles(),
    CodecProfiles: codecProfiles,
    SubtitleProfiles: subtitleProfiles,
  };
}
