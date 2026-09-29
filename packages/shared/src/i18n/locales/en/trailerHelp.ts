/**
 * Le guide « Bandes-annonces » en anglais — même structure que
 * `locales/fr/trailerHelp.ts`, mêmes clés (vérifié par
 * `trailerHelpVocabulary.test.ts`). Les libellés de Jellyfin sont ceux de son
 * interface anglaise (jellyfin-web 10.11 et 12.1) : « Libraries », « Manage
 * library », « Refresh metadata », « Search for missing metadata », « Plugins ».
 *
 * ⚠️ Lu aussi par le MOBILE : jamais « download » ici — pas même pour citer
 * Jellyfin, dont la section s'appelle « Metadata downloaders » : on la désigne
 * par ce qu'elle liste (« metadata source »), la case « TheMovieDb » y est.
 */
export default {
  // ── Le rappel de la fiche ──────────────────────────────────────────────
  hintLink: "Not seeing any trailers?",
  hintHide: "Don't show this reminder again",
  hintHidden: "Reminder hidden. The guide stays in Help › Trailers.",
  hintUndo: "Undo",
  hintTv: "Not seeing any trailers? The guide is in the Tentacle app, on the web or your phone: Help › Trailers.",

  // ── L'entrée dans l'aide ───────────────────────────────────────────────
  helpGuidesTitle: "Guides",
  helpEntryTitle: "Trailers",
  helpEntryBody: "Why some titles don't have one, and what to do.",

  // ── En-tête du guide ───────────────────────────────────────────────────
  title: "Trailers",
  lead: "Why some titles don't have one, and how to make them show up.",
  back: "Back",
  partEveryone: "For everyone",
  partAdmin: "For the administrator",
  contentsLabel: "Contents",

  // ── Pour tous ──────────────────────────────────────────────────────────
  notYouTitle: "It's not you",
  notYouBody: "Tentacle shows the trailers your Jellyfin server knows about. When a title has none, the “Trailer” button doesn't appear on its page: neither your device nor the app is at fault.",
  sourcesTitle: "Where they come from",
  sourceLocalTitle: "A file on the server",
  sourceLocalBody: "A trailer your administrator placed next to the movie. It comes first, in Tentacle's own player.",
  sourceRemoteTitle: "A YouTube video",
  sourceRemoteBody: "Found by Jellyfin on TheMovieDb, the big database of movies and shows, as long as the server is set up to look for it.",
  whatToDoTitle: "What can I do?",
  whatToDoBody: "Everything is set on the server: ask its administrator. The steps are right below, feel free to pass them on.",
  whatToDoAdmin: "You are the administrator: the steps are for you.",
  whatToDoAdminLink: "See the steps",
  notesTitle: "Good to know",
  noteRare: "Even on a well-configured server, some titles have no trailer: TheMovieDb doesn't know one for every title.",
  notePhone: "On a phone, a YouTube trailer opens in the YouTube app or in your browser.",
  noteAppleTv: "On Apple TV, YouTube trailers go through the Tentacle server. If they won't start, that's what needs updating.",

  // ── L'état du serveur, mesuré ──────────────────────────────────────────
  statusTitle: "On this server",
  statusReady: "Trailers are set up correctly: a title without one simply doesn't have one.",
  statusMisconfigured: "YouTube trailers aren't set up yet.",
  reasonTmdbPluginDisabled: "The TMDb plugin is disabled in Jellyfin.",
  reasonTmdbFetcherDisabled: "TheMovieDb isn't checked in every movie and show library.",
  reasonFewTrailers: "Only {{percent}}% of the titles known to TheMovieDb have a trailer: their metadata probably hasn't been refreshed.",
  statusCheckedAt: "Checked at {{time}}",

  // ── Pour l'administrateur ──────────────────────────────────────────────
  adminLead: "The first two steps are usually enough. The next ones add more.",
  optional: "Optional",
  stepLabel: "Step {{number}}",
  stepTmdbTitle: "Turn on TheMovieDb in Jellyfin",
  stepTmdbLibraries: "In the Jellyfin dashboard, open “Libraries”. For each movie and show library: “Manage library”, then check “TheMovieDb” wherever it is listed as a metadata source (for movies, for shows), and save.",
  stepTmdbPlugin: "Also check, under “Plugins”, that the TMDb plugin, bundled with Jellyfin, is active.",
  stepRefreshTitle: "Refresh the metadata",
  stepRefreshHow: "Still in “Libraries”, open each library's menu: “Refresh metadata”, mode “Search for missing metadata”, then “Refresh”. Jellyfin fetches trailers for the titles already there; titles added later get them on their own.",
  stepRefreshTentacle: "The overview of Tentacle's administration also offers this in one click.",
  stepLocalTitle: "Add your own trailers",
  stepLocalHow: "Place the file next to the movie, named like it with “-trailer”, or put it in a “trailers” subfolder. Jellyfin finds it at the next scan, and Tentacle plays it first, in its own player.",
  stepLocalExample: "Movies/Dune (2021)/Dune (2021).mkv\nMovies/Dune (2021)/Dune (2021)-trailer.mp4\nMovies/Dune (2021)/trailers/Official Trailer.mp4",
  stepLocalSeries: "For a show, the “trailers” subfolder goes in the show's folder.",
  stepJellyseerrTitle: "Connect Jellyseerr",
  stepJellyseerrBody: "With the Vigie extension connected to Jellyseerr, Tentacle adds every TheMovieDb video to the list: often a trailer in your language when Jellyfin only kept the English one.",
  stepUpdateTitle: "Keep Tentacle up to date",
  stepUpdateJellyfin12: "Jellyfin 12 changed how apps connect to it: with a Tentacle server that's too old, nothing gets through anymore, trailers included.",
  stepUpdateAppleTv: "On Apple TV, YouTube trailers are played thanks to the yt-dlp tool in Tentacle's Docker image. YouTube changes often: an up-to-date image gets them working again.",

  // ── Liens ──────────────────────────────────────────────────────────────
  linkJellyfinLibraries: "Jellyfin libraries",
  linkJellyfinPlugins: "Jellyfin plugins",
  linkJellyfinDocs: "Jellyfin documentation",
  linkAdminOverview: "Overview",
  linkAdminPlugins: "Tentacle extensions",
  linkAdminServices: "Services",
  linkOpensOutside: "opens outside the app",

  // ── Le rappel masqué ───────────────────────────────────────────────────
  hiddenNote: "The “Not seeing any trailers?” reminder is hidden on title pages.",
  showAgain: "Show it again",
  shownAgain: "The reminder will show up again on the titles concerned.",
};
