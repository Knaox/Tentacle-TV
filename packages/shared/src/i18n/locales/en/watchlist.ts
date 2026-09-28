/** The “My list” page — desktop, web and mobile. */
export default {
  stageFilterLabel: "Filter by progress",
  stageAll: "All",
  stageNew: "Not started",
  stageInProgress: "In progress",
  stageWatched: "Finished",

  statTotal_one: "{{count}} title",
  statTotal_other: "{{count}} titles",
  statInProgress: "{{count}} in progress",
  statWatched_one: "{{count}} finished",
  statWatched_other: "{{count}} finished",

  resumeTitle: "Resume",
  resumeHint: "Pick up where you left off",

  progressPercent: "{{percent}}% watched",
  remainingMinutes: "{{count}} min left",
  remainingHours: "{{hours}} h {{minutes}} min left",
  remainingEpisodes_one: "{{count}} episode left",
  remainingEpisodes_other: "{{count}} episodes left",
  notStarted: "Not started yet",
  finished: "Finished",

  play: "Play",
  resume: "Resume",
  playTitle: "Play {{title}}",
  openDetail: "View details",
  remove: "Remove from My list",
  removeTitle: "Remove {{title}} from My list",
  removed: "{{title}} left My list",
  undo: "Undo",

  viewLabel: "View",
  viewGrid: "Grid",
  viewList: "List",

  loading: "Loading your list",
  emptyBody: "Keep the movies and shows you want to watch here. The bookmark on any detail page adds them.",
  emptyExplore: "Explore home",
  emptySearch: "Search for a title",
  stageEmptyNew: "You've started everything on your list.",
  stageEmptyInProgress: "Nothing started yet.",
  stageEmptyWatched: "Nothing finished on your list yet.",
  showAll: "Show all",
} as const;
