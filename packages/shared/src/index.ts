export * from "./types/media";
export * from "./types/auth";
export * from "./utils/trickplay";
export * from "./utils/mediaQuality";
export * from "./utils/qualityLadder";
export * from "./utils/scrubStep";
export * from "./utils/playbackRates";
export * from "./utils/episodeCode";
export * from "./utils/textSearch";
export * from "./types/websocket";
export * from "./types/watchTogether";
export * from "./constants";
export * from "./subtitles/vtt";
export * from "./subtitles/sanitize";
export * from "./watchState";
// La décision « faut-il sauter l'intro, et quand » — une machine à états pure,
// partagée par le web, le bureau, l'Apple TV, l'Android TV et la LG.
export * from "./player/introSkip";
// Le contrat des segments de lecture (v1) et son résolveur — UNE implémentation,
// appelée par le backend (via miroir, cf. l'en-tête de segmentTypes.ts) et par
// la lecture locale hors ligne du bureau. Ré-exports NOMMÉS : TICKS_PER_MS y
// reste interne (le nom est déjà exporté par types/watchTogether).
export {
  PLAYBACK_SEGMENTS_VERSION,
  MIN_CREDIBLE_OUTRO_MS,
  POST_CREDITS_MIN_MS,
  POST_CREDITS_THRESHOLD_MS,
  SEGMENT_TYPES,
  emptyPlaybackSegments,
  findSegment,
  isSegmentType,
  parsePlaybackSegmentsResponse,
  type PlaybackSegmentsResponse,
  type ResolvedSegment,
  type SegmentType,
} from "./playback/segmentTypes";
export * from "./playback/segmentChapters";
export * from "./playback/resolveSegments";
export * from "./playback/playbackSettings";
export * from "./playback/playbackPresets";
export * from "./playback/segmentWindow";
export * from "./playback/skipCandidate";
export * from "./playback/nextTriggers";
export * from "./playback/overlayArbiter";
export * from "./playback/skipMuting";
export * from "./playback/autoNextEngine";
export * from "./playback/playbackSettingsStore";
export * from "./player/deviceSettings";
// Résolution des pistes selon les préférences : même algorithme côté backend
// (en ligne) et côté client (lecteur local hors ligne).
export * from "./preferences";
export * from "./serverConnection";
export { initI18n, detectLanguage, i18n } from "./i18n";
export * from "./data/media-licenses";
export * from "./theme";
export * from "./trailers";
