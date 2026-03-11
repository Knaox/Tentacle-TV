import type {
  DeviceProfile,
  DirectPlayProfile,
  TranscodingProfile,
  CodecProfile,
  SubtitleProfile,
} from "@tentacle-tv/shared";

/**
 * DeviceProfile pour Android ExoPlayer (react-native-video).
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
export function buildAndroidDeviceProfile(maxBitrate?: number): DeviceProfile {
  const directPlayProfiles: DirectPlayProfile[] = [
    {
      Container: "mp4,m4v,mkv,webm",
      Type: "Video",
      VideoCodec: "h264,hevc,vp9",
      AudioCodec: "aac,mp3,flac,opus,vorbis,ac3,eac3",
    },
    // Audio-only
    { Container: "mp3", Type: "Audio" },
    { Container: "aac,m4a", Type: "Audio" },
    { Container: "flac", Type: "Audio" },
    { Container: "ogg,webm", Type: "Audio" },
  ];

  const transcodingProfiles: TranscodingProfile[] = [
    // HLS TS — universel, fonctionne même sur émulateur
    {
      Container: "ts",
      Type: "Video",
      VideoCodec: "h264",
      AudioCodec: "aac,mp3",
      Protocol: "hls",
      Context: "Streaming",
      MaxAudioChannels: "6",
      MinSegments: 2,
      BreakOnNonKeyFrames: true,
      CopyTimestamps: true,
    },
    // HLS TS — devices modernes avec HEVC
    {
      Container: "ts",
      Type: "Video",
      VideoCodec: "hevc,h264",
      AudioCodec: "aac,mp3",
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
    TranscodingProfiles: transcodingProfiles,
    CodecProfiles: codecProfiles,
    SubtitleProfiles: subtitleProfiles,
  };
}
