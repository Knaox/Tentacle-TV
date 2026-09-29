/**
 * The PUBLIC share pages: shared list (watchlist or liked titles) and shared
 * detail (/share/:token/:itemId).
 *
 * ⚠️ Never the word "download" here: the phone mirror reads these keys.
 */
export default {
  kickerWatchlist: "Shared list",
  kickerLikes: "Shared liked titles",
  titleWatchlist: "{{name}}'s list",
  titleLikes: "{{name}}'s favorites",
  summaryTitles_one: "{{count}} title",
  summaryTitles_other: "{{count}} titles",
  summaryMovies_one: "{{count}} movie",
  summaryMovies_other: "{{count}} movies",
  summarySeries_one: "{{count}} series",
  summarySeries_other: "{{count}} series",
  summaryOffServer_one: "{{count}} not on the server",
  summaryOffServer_other: "{{count}} not on the server",
  readOnlyNote: "Read-only: you only see the titles {{name}} picked, nothing else from their account.",
  liveNote: "The link follows the list live.",

  joinTitle: "Want to watch them?",
  joinLead: "These titles live on a private Tentacle TV server. You need an account on that server to play them.",
  joinStep1: "Ask {{name}} for an invitation.",
  joinStep2: "Create your account with the code you received.",
  joinStep3: "Sign in: this share will be waiting for you.",
  joinSignIn: "Sign in",
  joinRegister: "I have an invitation",
  joinSteps: "Join the server in three steps",

  memberTitle: "You're on this server",
  memberLeadWatchlist: "Check titles to add them to your list.",
  memberLeadLikes: "Check titles to add them to your favorites.",
  memberLeadStats: "Your own stats are waiting in the app, from your profile.",
  openApp: "Open Tentacle TV",

  offServerBadge: "Not on server",
  offServerHint: "This title isn't on the server yet: there's no page to open.",
  selectTitle: "Select {{name}}",
  openTitle: "Open {{name}}",
  selectAll: "Check all",
  deselectAll: "Uncheck all",
  selectedCount_one: "{{count}} title checked",
  selectedCount_other: "{{count}} titles checked",
  addToWatchlist: "Add to my list",
  addToFavorites: "Add to my favorites",
  adding: "Adding…",
  addedWatchlist: "Added to your list",
  addedFavorites: "Added to your favorites",

  emptyTitle: "Nothing here yet",
  emptyLead: "{{name}} hasn't added anything to this list yet. Come back later: the link follows the list live.",
  errorTitle: "This share can't be opened",
  errorLead: "The link may have been revoked or copied wrong, or the server isn't responding. Try again, or ask for a new link.",
  retry: "Try again",
  goHome: "Go to home",
  loading: "Loading the share…",

  backToList: "Whole list",
  itemFrom: "Shared by {{name}}",
  itemPreviewNote: "Shared preview: playback needs an account on this server.",
  signInToWatch: "Sign in to watch",
  openDetail: "Open the page",
  trailers: "Trailers",
};
