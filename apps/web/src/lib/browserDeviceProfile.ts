import type { DeviceProfile, DirectPlayProfile, TranscodingProfile, CodecProfile, ProfileCondition, SubtitleProfile } from "@tentacle-tv/shared";

// ── Codec support detection via MediaSource.isTypeSupported ──

function supportsVideoCodec(codec: string, container = "mp4"): boolean {
  if (typeof MediaSource === "undefined" || !MediaSource.isTypeSupported) return false;
  return MediaSource.isTypeSupported(`video/${container}; codecs="${codec}"`);
}

function supportsAudioCodec(codec: string): boolean {
  if (typeof MediaSource === "undefined" || !MediaSource.isTypeSupported) return false;
  return MediaSource.isTypeSupported(`audio/mp4; codecs="${codec}"`);
}

const canPlayH264 = () => supportsVideoCodec("avc1.640029");
const canPlayHevc = () => supportsVideoCodec("hev1.1.6.L150.B0") || supportsVideoCodec("hvc1.1.6.L150.B0");
const canPlayVp9  = () => supportsVideoCodec("vp09.00.51.08", "webm") || supportsVideoCodec("vp09.00.51.08");
const canPlayAv1  = () => supportsVideoCodec("av01.0.15M.10");
const canPlayAac  = () => supportsAudioCodec("mp4a.40.2");
const canPlayMp3  = () => supportsAudioCodec("mp4a.69") || supportsAudioCodec("mp4a.6B");
const canPlayAc3  = () => supportsAudioCodec("ac-3");
const canPlayEac3 = () => supportsAudioCodec("ec-3");
const canPlayFlac = () => supportsAudioCodec("flac");
const canPlayOpus = () => supportsAudioCodec("opus");

// ── Profile builder ──

export function buildBrowserDeviceProfile(maxBitrate?: number): DeviceProfile {
  const videoCodecs: string[] = [];
  if (canPlayH264()) videoCodecs.push("h264");
  if (canPlayHevc()) videoCodecs.push("hevc");
  if (canPlayVp9())  videoCodecs.push("vp9");
  if (canPlayAv1())  videoCodecs.push("av1");

  const audioCodecs: string[] = [];
  if (canPlayAac())  audioCodecs.push("aac");
  if (canPlayMp3())  audioCodecs.push("mp3");
  if (canPlayAc3())  audioCodecs.push("ac3");
  if (canPlayEac3()) audioCodecs.push("eac3");
  if (canPlayFlac()) audioCodecs.push("flac");
  if (canPlayOpus()) audioCodecs.push("opus");

  const videoCodecStr = videoCodecs.join(",");
  const audioCodecStr = audioCodecs.join(",");

  // ── Direct play profiles ──
  const directPlayProfiles: DirectPlayProfile[] = [];
  if (videoCodecs.length > 0) {
    directPlayProfiles.push(
      { Container: "mp4,m4v", Type: "Video", VideoCodec: videoCodecStr, AudioCodec: audioCodecStr },
      { Container: "mkv", Type: "Video", VideoCodec: videoCodecStr, AudioCodec: audioCodecStr },
    );
    if (canPlayVp9()) {
      directPlayProfiles.push({ Container: "webm", Type: "Video", VideoCodec: "vp9", AudioCodec: "opus,vorbis" });
    }
  }
  if (audioCodecs.length > 0) {
    directPlayProfiles.push(
      { Container: "mp3", Type: "Audio" },
      { Container: "aac", Type: "Audio" },
      { Container: "flac", Type: "Audio" },
      { Container: "webma,webm", Type: "Audio" },
    );
  }

  // ── Transcoding profiles ──
  // HLS with h264+aac — universal browser fallback
  const transcodingProfiles: TranscodingProfile[] = [
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
  ];

  // If HEVC is supported, add a second HLS profile for HEVC transcode
  if (canPlayHevc()) {
    transcodingProfiles.push({
      Container: "ts",
      Type: "Video",
      VideoCodec: "hevc,h264",
      AudioCodec: audioCodecStr || "aac",
      Protocol: "hls",
      Context: "Streaming",
      MaxAudioChannels: "6",
      MinSegments: 2,
      BreakOnNonKeyFrames: true,
      CopyTimestamps: true,
    });
  }

  // Audio-only transcode
  transcodingProfiles.push({
    Container: "mp4",
    Type: "Audio",
    AudioCodec: "aac",
    Protocol: "hls",
    Context: "Streaming",
    MaxAudioChannels: "6",
  });

  // ── Codec profiles (constraints) ──
  const codecProfiles: CodecProfile[] = [];

  // H264: max level 5.1, max ref frames 16
  const h264Conditions: ProfileCondition[] = [
    { Condition: "LessThanEqual", Property: "VideoLevel", Value: "51", IsRequired: false },
    { Condition: "LessThanEqual", Property: "RefFrames", Value: "16", IsRequired: false },
  ];
  codecProfiles.push({ Type: "Video", Codec: "h264", Conditions: h264Conditions });

  // HEVC: max level 183 (6.1), max ref frames 16
  if (canPlayHevc()) {
    codecProfiles.push({
      Type: "Video",
      Codec: "hevc",
      Conditions: [
        { Condition: "LessThanEqual", Property: "VideoLevel", Value: "183", IsRequired: false },
        { Condition: "LessThanEqual", Property: "RefFrames", Value: "16", IsRequired: false },
      ],
    });
  }

  // Audio: max channels 6 (except for specific surround codecs)
  codecProfiles.push({
    Type: "VideoAudio",
    Conditions: [
      { Condition: "LessThanEqual", Property: "AudioChannels", Value: "6", IsRequired: false },
    ],
  });

  // ── Subtitle profiles ──
  const subtitleProfiles: SubtitleProfile[] = [
    { Format: "vtt", Method: "External" },
    { Format: "ass", Method: "External" },
    { Format: "ssa", Method: "External" },
    { Format: "srt", Method: "External" },
    { Format: "sub", Method: "External" },
    { Format: "subrip", Method: "External" },
    // Bitmap subtitles — must be burned in by the server
    { Format: "pgssub", Method: "Encode" },
    { Format: "dvdsub", Method: "Encode" },
    { Format: "dvbsub", Method: "Encode" },
  ];

  return {
    MaxStreamingBitrate: maxBitrate ?? 150_000_000,
    MaxStaticBitrate: 150_000_000,
    MusicStreamingTranscodingBitrate: 384_000,
    DirectPlayProfiles: directPlayProfiles,
    TranscodingProfiles: transcodingProfiles,
    CodecProfiles: codecProfiles,
    SubtitleProfiles: subtitleProfiles,
  };
}
