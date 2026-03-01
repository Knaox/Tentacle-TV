export default {
  // Plugin metadata
  pluginName: "Seer - Media Requests",
  pluginDescription: "Request movies and TV series via Jellyseerr. Discover content, request in 1 click, track your requests.",

  // Navigation
  navDiscover: "Discover",
  navRequests: "Requests",
  navMyRequests: "My Requests",
  navConfig: "Seer Configuration",
  navSeer: "Seer",

  // Discover
  discoverTitle: "Discover",
  searchPlaceholder: "Search for a movie, a series...",
  previousPage: "Previous",
  nextPage: "Next",
  noResults: "No results",
  noContent: "No content available",

  // Media types
  typeMovie: "Movie",
  typeSeries: "Series",
  typeAnime: "Anime",
  untitled: "Untitled",

  // Media card
  noImage: "No image",
  sending: "Sending...",
  request: "Request",
  viewSeasons: "View seasons",
  alreadyRequested: "Already requested",

  // Requests page
  filterAll: "All",
  filterQueued: "Pending",
  filterProcessing: "Processing",
  filterApproved: "Approved",
  filterAvailable: "Available",
  filterFailed: "Failed",
  myRequestsTitle: "My Requests",
  noRequestsAll: "You have no requests",
  noRequestsFiltered: "No requests with this status",

  // Request card
  seasonsLabel: "Season(s): {{seasons}}",
  retry: "Retry",
  delete: "Delete",
  notAvailable: "N/A",

  // Media detail modal
  requestingMovie: "Sending request...",
  requestMovie: "Request this movie",

  // Season picker
  seasonsTitle: "Seasons",
  selectAll: "All",
  selectNone: "None",
  seasonFallback: "Season {{number}}",
  episodeCount_one: "{{count}} episode",
  episodeCount_other: "{{count}} episodes",
  requestSeasons_one: "Request {{count}} season",
  requestSeasons_other: "Request {{count}} seasons",

  // Media type filter
  filterAllType: "All",
  filterMovies: "Movies",
  filterSeries: "Series",
  filterAnimes: "Anime",

  // Sort selector
  sortPopularity: "Popularity",
  sortTrending: "Trending",
  sortRating: "Rating",
  sortRecent: "Recent",

  // Config page
  configTitle: "Seer Configuration",
  statusConnected: "Connected",
  statusError: "Error",
  statusTesting: "Testing...",
  statusNotConfigured: "Not configured",
  urlLabel: "Jellyseerr URL",
  urlPlaceholder: "https://jellyseerr.example.com",
  testButton: "Test",
  apiKeyLabel: "API Key",
  apiKeyPlaceholder: "Jellyseerr API Key",
  toggleEnabled: "Enable Seer",
  toggleEnabledDesc: "Enable the media requests plugin",
  toggleAutoApprove: "Auto-approval",
  toggleAutoApproveDesc: "Automatically approve requests",
  userLimitLabel: "Limit per user (0 = unlimited)",
  saving: "Saving...",
  save: "Save",
  connectionSuccess: "Connection successful",
  connectionFailed: "Connection failed",
  connectionUnreachable: "Unable to reach server",
  configSaved: "Configuration saved",
  configSaveError: "Error saving configuration",
  networkError: "Network error",

  // Status labels
  statusQueued: "Pending",
  statusProcessing: "Processing",
  statusSentToSeer: "Sent",
  statusApproved: "Approved",
  statusDownloading: "Downloading",
  statusAvailable: "Available",
  statusFailed: "Failed",
  statusCancelled: "Cancelled",
} as const;
