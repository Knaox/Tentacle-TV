import type { CodecProfile, DeviceProfile, DirectPlayProfile, SubtitleProfile } from "@tentacle-tv/shared";
import { ANDROID_MPV_SUPPORT, supportList } from "@tentacle-tv/offline-core";
import { androidTranscodingProfiles } from "./androidTranscodingProfiles";

const EMBEDDED_SUBTITLES = ["ass", "ssa", "subrip", "srt", "pgssub", "dvdsub", "dvbsub", "vtt", "webvtt", "mov_text"];
const EXTERNAL_SUBTITLES = ["ass", "ssa", "subrip", "srt", "vtt", "webvtt"];

/**
 * DeviceProfile Android du lecteur AVANCÉ (libmpv) : le repli pour ce
 * qu'ExoPlayer ne démuxe ni ne décode (AVI, MPEG-2, DivX, VobSub) et pour
 * l'ASS stylé. Tout se lit en direct ; aucun `Encode`.
 */
export function buildAndroidMpvDeviceProfile(maxBitrate?: number): DeviceProfile {
  const directPlayProfiles: DirectPlayProfile[] = [
    {
      Container: supportList(ANDROID_MPV_SUPPORT.containers),
      Type: "Video",
      VideoCodec: supportList(ANDROID_MPV_SUPPORT.videoCodecs),
      AudioCodec: supportList(ANDROID_MPV_SUPPORT.audioCodecs),
    },
    { Container: "mp3", Type: "Audio" },
    { Container: "aac,m4a", Type: "Audio" },
    { Container: "flac", Type: "Audio" },
    { Container: "ogg,oga,opus,webm", Type: "Audio" },
    { Container: "wav", Type: "Audio" },
  ];

  const codecProfiles: CodecProfile[] = [
    {
      Type: "VideoAudio",
      Conditions: [
        { Condition: "LessThanEqual", Property: "AudioChannels", Value: "8", IsRequired: false },
      ],
    },
  ];

  const subtitleProfiles: SubtitleProfile[] = [
    ...EMBEDDED_SUBTITLES.map((format): SubtitleProfile => ({ Format: format, Method: "Embed" })),
    ...EXTERNAL_SUBTITLES.map((format): SubtitleProfile => ({ Format: format, Method: "External" })),
    ...EXTERNAL_SUBTITLES.map((format): SubtitleProfile => ({ Format: format, Method: "Hls" })),
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
