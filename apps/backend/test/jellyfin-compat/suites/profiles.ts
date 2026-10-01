/**
 * Les profils d'appareil des suites, au plus simple : un lecteur qui lit tout
 * ce que la médiathèque synthétique contient (lecture directe), un navigateur
 * limité au H.264 (le HEVC y part en transcodage HLS), et un lecteur
 * AVFoundation (AVPlayer, Safari) qui n'affiche le HEVC que sous `hvc1`.
 */

import { avPlayerHevcTagCondition } from "../../../../../packages/shared/src/playback/hevcTag";
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

/**
 * Un lecteur AVFoundation, comme le lecteur système d'iOS ou Safari : MP4 et
 * MOV en direct, HLS fMP4 (seul conteneur où le HEVC se copie) avant le TS,
 * et la condition d'étiquette partagée sur le HEVC.
 */
export const AVFOUNDATION_PROFILE: DeviceProfile = {
  MaxStreamingBitrate: 120_000_000,
  MaxStaticBitrate: 120_000_000,
  DirectPlayProfiles: [{ Type: "Video", Container: "mp4,m4v,mov", VideoCodec: "h264,hevc", AudioCodec: "aac,ac3,eac3" }],
  TranscodingProfiles: [
    { Type: "Video", Container: "mp4", Protocol: "hls", VideoCodec: "hevc,h264", AudioCodec: "aac", Context: "Streaming", MaxAudioChannels: "6", MinSegments: 1, BreakOnNonKeyFrames: true },
    ...HLS_H264,
  ],
  CodecProfiles: [{ Type: "Video", Codec: "hevc", Conditions: [avPlayerHevcTagCondition()] }],
  SubtitleProfiles: SUBTITLES,
};
