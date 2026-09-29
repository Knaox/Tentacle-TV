/**
 * Deux profils d'appareil, au plus simple : un lecteur qui lit tout ce que la
 * médiathèque synthétique contient (lecture directe), et un navigateur limité
 * au H.264 (le HEVC y part en transcodage HLS).
 */

import type { DeviceProfile } from "../../../../../packages/shared/src/types/media";

const SUBTITLES: DeviceProfile["SubtitleProfiles"] = [
  { Format: "vtt", Method: "External" },
  { Format: "srt", Method: "External" },
  { Format: "ass", Method: "External" },
];

const HLS_H264: DeviceProfile["TranscodingProfiles"] = [
  { Type: "Video", Container: "ts", Protocol: "hls", VideoCodec: "h264", AudioCodec: "aac", Context: "Streaming", MaxAudioChannels: "2", MinSegments: 1, BreakOnNonKeyFrames: true },
];

export const DIRECT_PROFILE: DeviceProfile = {
  MaxStreamingBitrate: 120_000_000,
  MaxStaticBitrate: 120_000_000,
  DirectPlayProfiles: [{ Type: "Video", Container: "mkv,mp4,mov", VideoCodec: "h264,hevc", AudioCodec: "aac,ac3,eac3" }],
  TranscodingProfiles: HLS_H264,
  CodecProfiles: [],
  SubtitleProfiles: SUBTITLES,
};

export const H264_ONLY_PROFILE: DeviceProfile = {
  MaxStreamingBitrate: 20_000_000,
  MaxStaticBitrate: 20_000_000,
  DirectPlayProfiles: [{ Type: "Video", Container: "mp4", VideoCodec: "h264", AudioCodec: "aac" }],
  TranscodingProfiles: HLS_H264,
  CodecProfiles: [],
  SubtitleProfiles: SUBTITLES,
};
