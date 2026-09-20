import type { TranscodingProfile } from "@tentacle-tv/shared";

/** Les profils de TRANSCODAGE Android, communs aux deux moteurs (plafond de débit, palier choisi, replis). */
export function androidTranscodingProfiles(): TranscodingProfile[] {
  return [
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
}
