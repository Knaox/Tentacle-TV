// Re-export depuis @tentacle-tv/shared pour conserver les imports historiques.
// La détection effective vit dans packages/shared/src/utils/mediaQuality.ts
// (partagée avec mobile + TV).
export {
  extractMediaQuality,
  extractSourceQuality,
  formatBitrateMbps,
} from "@tentacle-tv/shared";
export type {
  Resolution,
  SourceResolution,
  AudioLabel,
  MediaQuality,
  SourceQuality,
  QualityKey,
  QualityPreset,
} from "@tentacle-tv/shared";
