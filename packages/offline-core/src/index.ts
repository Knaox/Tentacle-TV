/**
 * Le cœur hors ligne, commun au bureau et au mobile.
 *
 * Tout ce qui est exporté d'ici est PORTABLE : ni Node, ni Electron, ni Expo.
 * Chaque plateforme fournit ses adaptateurs (`adapters.ts`) — les Nôtres pour
 * Node vivent sous `./node`, jamais ré-exportés d'ici.
 *
 * Le main Electron ne consomme pas ce paquet : il en garde une copie de
 * `src/core` et `src/node`, recopiée par `mirror.mjs` et verrouillée par un
 * test d'égalité.
 */

export * from "./core/adapters";
export * from "./core/utf8";
export * from "./core/json";
export { bit, flag, integer, integerOrNull, rowId, text, textOrNull } from "./core/rows";
export * from "./core/schema";
export * from "./core/db";
export * from "./core/paths";
export * from "./core/store";
export * from "./core/queue";
export * from "./core/enqueue";
export * from "./core/listing";
export * from "./core/purge";
export * from "./core/playback";
export * from "./core/meta";
export * from "./core/fetcher";
export * from "./core/transfer";
export * from "./core/transferNet";
export * from "./core/worker";
export * from "./core/engine";
export * from "./core/presets";
export type { CachedSession } from "./core/session";
export * as session from "./core/session";
export * as trickplay from "./core/trickplay";
export * as segments from "./core/segments";
export * as subs from "./core/subs";
export * as episodeNumbers from "./core/episodeNumbers";
export { heal } from "./core/heal";
export { snapshot } from "./core/snapshot";

// Hors du cœur miroir : la logique pure que l'interface (web comme mobile)
// partage — catalogue, navigation d'épisode locale, sélection, connectivité,
// segments locaux, droits, resynchronisation.
export * from "./catalog/offlineGroups";
export * from "./catalog/localEpisodeNav";
export * from "./catalog/offlineHighlights";
export {
  prune as pruneSelection,
  state as selectionState,
  toggle as toggleSelection,
  toggleAll as toggleAllSelection,
  type SelectionState,
} from "./catalog/selection";
export * from "./connectivity/connectivityMachine";
export * from "./playback/localSegments";
export * from "./playback/localPlaybackProgress";
export * from "./playback/playbackFailure";
export * from "./playback/sideCarNames";
export * from "./playback/langSubtags";
export * from "./playback/langNames";
export * from "./playback/localTrackNames";
export * from "./playback/localTrackLabels";
export * from "./prefs/trackPrefsCache";
export * from "./sync/capabilities";
export * from "./sync/reportBody";
export * from "./core/reconcile";
export * from "./variants/platformSupport";
export * from "./variants/offlineVariants";
