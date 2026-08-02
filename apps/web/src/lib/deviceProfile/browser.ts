import type { DeviceProfile, DirectPlayProfile, TranscodingProfile, CodecProfile } from "@tentacle-tv/shared";
import {
  CONDITIONS_HEVC, conditionsH264, DEBIT_MUSIQUE, PROFIL_AUDIO_6_CANAUX, PROFIL_AUDIO_SEUL,
  profilHlsTs, SOUS_TITRES_BITMAP, SOUS_TITRES_TEXTE,
} from "./blocs";
import {
  canPlayAac, canPlayAc3, canPlayAv1, canPlayContainer, canPlayEac3, canPlayFlac,
  canPlayH264, canPlayHevc, canPlayMp3, canPlayOpus, canPlayVp9, IS_NATIVE_HLS,
} from "./codecs";

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
  // ONLY list containers the browser can play natively via <video src>.
  // MKV is NOT supported natively by any browser — it falls through to
  // DirectStream (remux to HLS via ffmpeg -c copy, nearly free).
  const directPlayProfiles: DirectPlayProfile[] = [];
  if (videoCodecs.length > 0) {
    directPlayProfiles.push(
      { Container: "mp4,m4v", Type: "Video", VideoCodec: videoCodecStr, AudioCodec: audioCodecStr },
    );
    if (canPlayContainer("video/webm") && canPlayVp9()) {
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
  const transcodingProfiles: TranscodingProfile[] = [profilHlsTs("h264", "aac")];

  // HEVC in HLS: only for browsers using hls.js/MSE (Chrome/Brave/Firefox/Edge).
  // Safari native HLS requires fMP4 segments for HEVC — TS segments don't work.
  // IS_NATIVE_HLS is true only on Safari → this profile is skipped there.
  if (canPlayHevc() && !IS_NATIVE_HLS) {
    transcodingProfiles.push(profilHlsTs("hevc,h264", audioCodecStr || "aac"));
  }

  transcodingProfiles.push(PROFIL_AUDIO_SEUL);

  // ── Codec profiles (constraints) ──
  const codecProfiles: CodecProfile[] = [
    { Type: "Video", Codec: "h264", Conditions: conditionsH264("51") },
  ];
  if (canPlayHevc()) {
    codecProfiles.push({ Type: "Video", Codec: "hevc", Conditions: CONDITIONS_HEVC });
  }
  codecProfiles.push(PROFIL_AUDIO_6_CANAUX);

  return {
    MaxStreamingBitrate: maxBitrate ?? 150_000_000,
    MaxStaticBitrate: 150_000_000,
    MusicStreamingTranscodingBitrate: DEBIT_MUSIQUE,
    DirectPlayProfiles: directPlayProfiles,
    TranscodingProfiles: transcodingProfiles,
    CodecProfiles: codecProfiles,
    SubtitleProfiles: [...SOUS_TITRES_TEXTE, ...SOUS_TITRES_BITMAP],
  };
}
