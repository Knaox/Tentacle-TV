import type {
  DeviceProfile,
  DirectPlayProfile,
  TranscodingProfile,
  CodecProfile,
  SubtitleProfile,
} from "@tentacle-tv/shared";

/**
 * DeviceProfile pour iOS AVPlayer (react-native-video).
 *
 * AVPlayer supporte nativement :
 * - Vidéo : H.264 (AVC), HEVC (H.265)
 * - Audio : AAC, FLAC, AC3, EAC3, ALAC, MP3
 * - Containers : MP4, MOV, HLS (fMP4/TS)
 * - PAS de MKV, AVI, WMV, DTS, TrueHD
 *
 * Sans ce profil, Jellyfin tente du direct play sur des MKV
 * → écran noir car AVPlayer ne lit pas ce container.
 */
export function buildIosDeviceProfile(maxBitrate?: number): DeviceProfile {
  const directPlayProfiles: DirectPlayProfile[] = [
    {
      Container: "mp4,m4v,mov",
      Type: "Video",
      VideoCodec: "h264,hevc",
      AudioCodec: "aac,flac,alac,ac3,eac3,mp3",
    },
    // Audio-only
    { Container: "mp3", Type: "Audio" },
    { Container: "aac,m4a", Type: "Audio" },
    { Container: "flac", Type: "Audio" },
    { Container: "alac", Type: "Audio" },
  ];

  const transcodingProfiles: TranscodingProfile[] = [
    // HLS avec fMP4 — préféré par AVPlayer pour HEVC
    {
      Container: "mp4",
      Type: "Video",
      VideoCodec: "hevc,h264",
      AudioCodec: "aac,ac3,eac3",
      Protocol: "hls",
      Context: "Streaming",
      MaxAudioChannels: "6",
      MinSegments: 2,
      BreakOnNonKeyFrames: true,
      CopyTimestamps: true,
    },
    // Fallback TS segments
    {
      Container: "ts",
      Type: "Video",
      VideoCodec: "h264",
      AudioCodec: "aac",
      Protocol: "hls",
      Context: "Streaming",
      MaxAudioChannels: "6",
      MinSegments: 2,
      BreakOnNonKeyFrames: true,
      CopyTimestamps: true,
    },
    // Audio-only
    {
      Container: "mp4",
      Type: "Audio",
      AudioCodec: "aac",
      Protocol: "hls",
      Context: "Streaming",
      MaxAudioChannels: "6",
    },
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
    TranscodingProfiles: transcodingProfiles,
    CodecProfiles: codecProfiles,
    SubtitleProfiles: subtitleProfiles,
  };
}
