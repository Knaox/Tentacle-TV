/**
 * « Refine » tab: a stack of films and shows to rate with one gesture.
 * Read by web, desktop and mobile — no "download" wording here (mobile rule,
 * see offline.ts).
 */
export default {
  title: "Refine",
  subtitle: "Rate films and shows: your recommendations learn from every swipe.",

  like: "Like",
  superlike: "Love it",
  dislike: "Not for me",
  skip: "Skip",
  undo: "Undo last swipe",
  undoShort: "Undo",
  showInfo: "Show synopsis",
  hideInfo: "Back to poster",

  stampLike: "Like",
  stampSuper: "Love it",
  stampNope: "Nope",

  movie: "Film",
  series: "Series",
  seasons_one: "{{count}} season",
  seasons_other: "{{count}} seasons",
  runtime: "{{minutes}} min",
  inLibrary: "In your library",
  notInLibrary: "Not in your library",
  reason: "Because you liked {{title}}",
  sourcePopular: "Trending",
  sourceExplore: "Discovery",
  noOverview: "No synopsis for this title.",
  cardLabel: "{{title}} ({{year}})",

  countsLabel: "Your ratings",
  countLike_one: "{{count}} like",
  countLike_other: "{{count}} likes",
  countSuper_one: "{{count}} love",
  countSuper_other: "{{count}} loves",
  countDislike_one: "{{count}} pass",
  countDislike_other: "{{count}} passes",

  libraryOnlyTitle: "Your library only",
  libraryOnlyBody:
    "No TMDB key is configured on this server, so the stack only offers titles from your library. An administrator can add one in Administration › Metadata.",

  emptyTitle: "You've been through everything",
  emptyBody: "Nothing left to rate for now. Come back later: the stack refreshes.",
  emptyCta: "See my recommendations",
  errorTitle: "Couldn't load the stack",
  retry: "Try again",
  saveFailed: "That rating wasn't saved — the card is back on top of the stack.",
  undone: "Last swipe undone",

  hint: "Swipe right to like, left to pass, up to love it.",
  shortcutsLabel: "Keyboard shortcuts",
  keyLeft: "Not for me",
  keyRight: "Like",
  keyUp: "Love it",
  keyDown: "Skip",
  keyUndo: "Undo",
  keyInfo: "Synopsis",
  keySpace: "Space",
};
