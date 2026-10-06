import type { DeviceVideoSource } from "./deviceVideoSupport";
import type { AudioSourceInfo, SubtitleSourceInfo } from "./devicePlaybackVerdict";

/**
 * La matrice de la fiche du mode Lite (chantier 5) : les fichiers types, tels
 * que Jellyfin les décrit (`MediaStreams`). Partagée par les tests du verdict
 * et le rapport.
 */

const at24 = { RealFrameRate: 23.976 };
const uhd = { Width: 3840, Height: 2160 };
const fhd = { Width: 1920, Height: 1080 };

export const MATRIX_VIDEO = {
  "H.264 1080p": { Codec: "h264", Profile: "High", BitDepth: 8, ...fhd, ...at24, VideoRangeType: "SDR" },
  "HEVC 8 bits 1080p": { Codec: "hevc", Profile: "Main", BitDepth: 8, ...fhd, ...at24, VideoRangeType: "SDR" },
  "HEVC 8 bits 4K": { Codec: "hevc", Profile: "Main", BitDepth: 8, ...uhd, ...at24, VideoRangeType: "SDR" },
  "HEVC 10 bits 1080p": { Codec: "hevc", Profile: "Main 10", BitDepth: 10, ...fhd, ...at24, VideoRangeType: "SDR" },
  "HEVC 10 bits 4K": { Codec: "hevc", Profile: "Main 10", BitDepth: 10, ...uhd, ...at24, VideoRangeType: "SDR" },
  "HDR10 4K": { Codec: "hevc", Profile: "Main 10", BitDepth: 10, ...uhd, ...at24, VideoRangeType: "HDR10" },
  "DV P5 4K": {
    Codec: "hevc", Profile: "Main 10", BitDepth: 10, ...uhd, ...at24,
    VideoRangeType: "DOVI", DvProfile: 5, DvBlSignalCompatibilityId: 0,
  },
  "DV P7 4K": {
    Codec: "hevc", Profile: "Main 10", BitDepth: 10, ...uhd, ...at24,
    VideoRangeType: "DOVIWithEL", DvProfile: 7, DvBlSignalCompatibilityId: 6,
  },
  "DV P8 4K": {
    Codec: "hevc", Profile: "Main 10", BitDepth: 10, ...uhd, ...at24,
    VideoRangeType: "DOVIWithHDR10", DvProfile: 8, DvBlSignalCompatibilityId: 1,
  },
  "VP9 4K": { Codec: "vp9", Profile: "Profile 0", BitDepth: 8, ...uhd, ...at24, VideoRangeType: "SDR" },
  "AV1 4K": { Codec: "av1", Profile: "Main", BitDepth: 10, ...uhd, ...at24, VideoRangeType: "HDR10" },
} satisfies Record<string, DeviceVideoSource>;

export const MATRIX_AUDIO = {
  "AAC 2.0": { Codec: "aac", Profile: "LC", Channels: 2 },
  "AC3 5.1": { Codec: "ac3", Channels: 6 },
  "E-AC3 Atmos": { Codec: "eac3", Profile: "Dolby Digital Plus + Dolby Atmos", Channels: 6 },
  "TrueHD Atmos": { Codec: "truehd", Profile: "Dolby TrueHD + Dolby Atmos", Channels: 8 },
  "DTS-HD MA": { Codec: "dts", Profile: "DTS-HD MA", Channels: 8 },
} satisfies Record<string, AudioSourceInfo>;

export const MATRIX_SUBTITLES = {
  SRT: { Codec: "subrip", IsExternal: false },
  ASS: { Codec: "ass", IsExternal: false },
  PGS: { Codec: "PGSSUB", IsExternal: false },
} satisfies Record<string, SubtitleSourceInfo>;

export type MatrixVideo = keyof typeof MATRIX_VIDEO;
export type MatrixAudio = keyof typeof MATRIX_AUDIO;
export type MatrixSubtitle = keyof typeof MATRIX_SUBTITLES;
