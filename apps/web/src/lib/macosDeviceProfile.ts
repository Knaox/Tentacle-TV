import type { DeviceProfile } from "@tentacle-tv/shared";

/**
 * Device profile for macOS Tauri (WKWebView / AVFoundation).
 *
 * WKWebView uses Safari's media engine (AVFoundation) which natively supports:
 * - HEVC hardware decode (including HDR10, Dolby Vision on Apple Silicon)
 * - H.264 up to Level 5.2
 * - FLAC, ALAC, AC3, EAC3 audio
 * - fMP4 HLS segments (required for HEVC HLS — TS segments don't work in Safari)
 *
 * Differences vs browserDeviceProfile:
 * - HEVC in DirectPlay (mp4/m4v/mov) — Chrome can't do this
 * - HEVC transcoding via fMP4 HLS (not TS)
 * - FLAC, ALAC, AC3, EAC3 in DirectPlay audio
 * - No WebM/VP9 (AVFoundation doesn't support it)
 */
export function buildMacOSDeviceProfile(maxBitrate?: number): DeviceProfile {
  return {
    MaxStreamingBitrate: maxBitrate ?? 120_000_000,
    MaxStaticBitrate: 150_000_000,
    MusicStreamingTranscodingBitrate: 384_000,
    DirectPlayProfiles: [
      { Container: "mp4,m4v,mov", Type: "Video",
        VideoCodec: "h264,hevc", AudioCodec: "aac,flac,alac,ac3,eac3,mp3" },
      { Container: "mp3", Type: "Audio" },
      { Container: "aac,m4a", Type: "Audio" },
      { Container: "flac", Type: "Audio" },
    ],
    TranscodingProfiles: [
      // Primary: fMP4 HLS with HEVC (AVFoundation requires fMP4 for HEVC, not TS)
      { Container: "mp4", Type: "Video", VideoCodec: "hevc,h264",
        AudioCodec: "aac,ac3,eac3", Protocol: "hls", Context: "Streaming",
        MaxAudioChannels: "6", MinSegments: 2,
        BreakOnNonKeyFrames: true, CopyTimestamps: true },
      // Fallback: TS HLS with H264
      { Container: "ts", Type: "Video", VideoCodec: "h264",
        AudioCodec: "aac", Protocol: "hls", Context: "Streaming",
        MaxAudioChannels: "6", MinSegments: 2,
        BreakOnNonKeyFrames: true, CopyTimestamps: true },
      // Audio-only
      { Container: "mp4", Type: "Audio", AudioCodec: "aac",
        Protocol: "hls", Context: "Streaming", MaxAudioChannels: "6" },
    ],
    CodecProfiles: [
      { Type: "Video", Codec: "h264", Conditions: [
        { Condition: "LessThanEqual", Property: "VideoLevel", Value: "52", IsRequired: false },
        { Condition: "LessThanEqual", Property: "RefFrames", Value: "16", IsRequired: false },
      ]},
      { Type: "Video", Codec: "hevc", Conditions: [
        { Condition: "LessThanEqual", Property: "VideoLevel", Value: "183", IsRequired: false },
        { Condition: "LessThanEqual", Property: "RefFrames", Value: "16", IsRequired: false },
      ]},
      { Type: "VideoAudio", Conditions: [
        { Condition: "LessThanEqual", Property: "AudioChannels", Value: "6", IsRequired: false },
      ]},
    ],
    SubtitleProfiles: [
      { Format: "vtt", Method: "External" }, { Format: "vtt", Method: "Hls" },
      { Format: "srt", Method: "External" }, { Format: "srt", Method: "Hls" },
      { Format: "subrip", Method: "External" }, { Format: "subrip", Method: "Hls" },
      { Format: "ass", Method: "External" }, { Format: "ass", Method: "Hls" },
      { Format: "ssa", Method: "External" }, { Format: "ssa", Method: "Hls" },
      // Bitmap — burned in by the server
      { Format: "pgssub", Method: "Encode" },
      { Format: "dvdsub", Method: "Encode" },
      { Format: "dvbsub", Method: "Encode" },
    ],
  };
}
