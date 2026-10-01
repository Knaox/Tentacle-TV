// La lecture : le flux, le reporting, la navigation d'épisodes, les segments
// (intro, génériques) et leur coquille d'overlay, les vignettes et le débit.
export { useStream, type StreamOptions } from "../hooks/useStream";
export { usePlaybackReporting, type PlaybackReportingOptions, type PlaybackReporter } from "../hooks/usePlayback";
// La file PERSISTÉE des rapports (opt-in, la TV) : un arrêt n'est jamais perdu.
export {
  configurePlaybackOutbox, readPlaybackOutbox, OUTBOX_KEY,
  type OutboxOwner, type OutboxStorage, type OutboxEntry, type OutboxFlushResult,
} from "../hooks/playbackOutbox";
export { flushPlaybackOutboxFor } from "../hooks/playbackOutboxFlush";
// Destruction d'un transcode actif, hors du hook de reporting : les filets de
// lecture renégocient une session sans en tenir un (cf. useWebPlaybackFallbacks).
export { killActiveEncoding } from "../hooks/playbackTransport";
export { useEpisodeNavigation, type EpisodeNavigation } from "../hooks/useEpisodeNavigation";
export {
  useIntroSkipper, normalizeSkipSegments,
  type SkipSegments, type RawSkipSources, type MediaSegmentsResponse, type PluginSegmentDict, type PluginTimestamps,
} from "../hooks/useIntroSkipper";
// Segments de lecture — le contrat résolu par le backend, les réglages
// partagés du compte, et LA coquille d'overlay des six surfaces.
export { usePlaybackSegments } from "../hooks/usePlaybackSegments";
export {
  usePlaybackSettings, usePlaybackSettingsStore, setPlaybackSettings, rehydratePlaybackSettings, initPlaybackSettingsStore,
  setGroupPlaybackSettings, groupPlaybackSettings, useOwnPlaybackSettings,
} from "../hooks/usePlaybackSettings";
export { usePlaybackOverlay } from "../playback/usePlaybackOverlay";
export type { SkipProposal, PlaybackOverlayInput, PlaybackOverlayResult } from "../playback/playbackOverlay.types";
export { useMutedSegments, NO_MUTED_SEGMENTS } from "../playback/useMutedSegments";
export { usePostCreditsClaim } from "../playback/usePostCreditsClaim";
export { buildTrickplayTileUrl } from "../jellyfin/trickplayUrl";
// Parler à Jellyfin EN DIRECT (streaming direct) : `Authorization` et `ApiKey`,
// les seules formes que Jellyfin 12 garde (cf. directAuth).
export { directJellyfinHeaders, withDirectApiKey } from "../jellyfin/directAuth";

// Mesure du débit réel (téléchargement témoin Jellyfin BitrateTest) — sert le
// cap automatique de qualité des clients TV.
export { primeBitrateMeasure, cachedBitrate, measureBitrate } from "../jellyfin/bitrateMeasure";
