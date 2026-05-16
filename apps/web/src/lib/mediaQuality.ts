// Re-export depuis @tentacle-tv/shared pour conserver les imports historiques.
// La détection effective vit dans packages/shared/src/utils/mediaQuality.ts
// (partagée avec mobile + TV).
export {
  extractMediaQuality,
  extractSourceQuality,
  formatBitrateMbps,
  findPreset,
  QUALITY_PRESETS,
} from "@tentacle-tv/shared";
export type {
  Resolution,
  SourceResolution,
  AudioFlag,
  MediaQuality,
  SourceQuality,
  QualityKey,
  QualityPreset,
} from "@tentacle-tv/shared";
