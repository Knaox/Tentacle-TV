/**
 * The titles an account is waiting for from a request extension
 * (`titles.mine` contract). Never the word for downloading: see the French
 * file and `requestsVocabulary.test.ts`.
 */
export default {
  statePending: "Pending",
  stateArriving: "In progress",
  stateImporting: "Adding to library",
  stateBlocked: "Stuck",
  stateArrived: "Available",
  percent: "{{percent}}%",
  dockLabel: "My requests",
  dockEmpty: "Nothing in the queue",
  count_one: "{{count}} request",
  count_other: "{{count}} requests",
  empty: "You have nothing in the queue.",
  loading: "Loading…",
  seasons_one: "Season {{list}}",
  seasons_other: "Seasons {{list}}",
  and: "and",

  // Apple TV — requesting a title missing from the library (collection,
  // search, seasons sheet).
  followOnPhone: "To follow its progress, open Tentacle on your phone.",
  hintRequest: "OK: request",
  hintSeasons: "OK: choose seasons",
  searchRow: "Available to request",
  seasonsSubtitle: "Check the seasons to request.",
  seasonsSubmit_one: "Request {{count}} season",
  seasonsSubmit_other: "Request {{count}} seasons",
  seasonFallback: "Season {{number}}",
  seasonSpecials: "Specials",
  seasonNamed: "{{season}} · {{name}}",
  seasonsAll: "All missing seasons",
  seasonsShortcut: "Play/Pause: request",
  seasonsShortcutAndroid: "Play/Pause, or check then Request",
  seasonEpisodes_one: "{{count}} episode",
  seasonEpisodes_other: "{{count}} episodes",
  seasonsLoading: "Reading the seasons…",
  seasonsFailed: "The seasons can't be read right now. Try again later.",
  seasonsNone: "All its seasons are already here or requested.",

  missingSeasons_one: "{{count}} season to request",
  missingSeasons_other: "{{count}} seasons to request",
  requestMissing: "Request missing seasons",
  seasonInLibrary: "In your library",
  seasonToRequest: "To request",
  seasonsSubmitIdle: "Request",
};
