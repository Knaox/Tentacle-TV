/**
 * Admin → Metadata: the TMDB key, the recommendation run and the streaming
 * region. The rail label (`admin:navMetadata`) and the "missing key" banner
 * (`admin:tmdbKey*`) stay in `admin`.
 */
export default {
  title: "Metadata",
  description:
    "What enriches Tentacle beyond Jellyfin: TMDB for recommendations, and the country whose streaming platforms are shown.",
  loadError: "Couldn't read the metadata settings.",
  loadErrorHint: "The Tentacle server didn't answer. Check the connection, then try again.",
  retry: "Try again",
  // TMDB card
  tmdbTitle: "TMDB",
  tmdbDescription:
    "The Movie Database powers rich recommendations — similar titles, actors, keywords, posters from outside the library — and anonymous rating sync. Without a key, the engine falls back to library genres, for every account.",
  tmdbGetKey: "Create a free key on themoviedb.org",
  statusConfigured: "Configured",
  statusMissing: "Not configured",
  statusRejected: "Rejected by TMDB",
  keySaved: "Saved key",
  keyEndsWith: "Key ending in {{last4}}",
  keySourceDb: "entered here",
  keySourceEnv: "environment variable",
  keyEnvNote:
    "Set by the server's TMDB_API_KEY environment variable, which takes precedence over anything entered here. To change it, edit the variable and restart the server.",
  keyLabel: "API key (v3)",
  keyNewLabel: "New API key (v3)",
  keyPlaceholder: "Paste the v3 API key",
  keyShow: "Show key",
  keyHide: "Hide key",
  keyHintV4:
    "This looks like the v4 access token (“API Read Access Token”). Tentacle needs the v3 API key: 32 characters, just above it on the same TMDB page.",
  keyHintFormat: "A v3 key is 32 characters long: digits and the letters a to f.",
  test: "Test",
  testSaved: "Test key",
  save: "Save",
  cancel: "Cancel",
  replace: "Replace",
  remove: "Remove",
  testValid: "TMDB accepts this key.",
  testValidSaved: "TMDB accepts the saved key.",
  testInvalid: "TMDB rejects this key: make sure it is the v3 API key.",
  testInvalidSaved: "TMDB rejects the saved key — revoked or regenerated since? Replace it.",
  testUnreachable:
    "TMDB isn't answering the server: the key couldn't be checked. Check the server's Internet connection, then try again.",
  testUnsupported: "Testing needs a newer Tentacle server.",
  testFailed: "The test couldn't complete.",
  saveInvalid: "TMDB rejects this key — nothing was saved.",
  saveUnreachable: "TMDB isn't answering the server — nothing was saved. Try again in a moment.",
  saveFailed: "Couldn't save.",
  keySavedToast: "TMDB key saved.",
  removeConfirmTitle: "Remove the TMDB key?",
  removeConfirmMessage:
    "Recommendations go back to generic for every account: no “For you”, no taste profile, no platform filters. You can add a key again at any time.",
  removeConfirm: "Remove key",
  removeFailed: "Couldn't remove the key.",
  keyRemovedToast: "TMDB key removed.",
  // Recommendation run for every account ("fan-out")
  fanoutTitle: "Computing recommendations",
  fanoutPreparing: "Getting ready…",
  fanoutProgress_one: "{{processed}} of {{count}} account",
  fanoutProgress_other: "{{processed}} of {{count}} accounts",
  fanoutProgressLabel: "Recommendation run progress",
  fanoutRunningHint:
    "Each account takes dozens of TMDB calls. The run keeps going on the server if you leave this page.",
  fanoutDone_one: "Last run finished {{when}}: {{count}} account up to date.",
  fanoutDone_other: "Last run finished {{when}}: {{count}} accounts up to date.",
  fanoutFailed_one: "{{count}} failed — details are in the server logs.",
  fanoutFailed_other: "{{count}} failed — details are in the server logs.",
  fanoutInterrupted: "Last run stopped {{when}}, at {{processed}} of {{total}} accounts.",
  justNow: "just now",
  // Streaming region
  regionTitle: "Streaming platforms",
  regionDescription:
    "The country whose offers are shown: Netflix, Crunchyroll… chips on detail pages, and platform filters in recommendations. Changing it asks TMDB for nothing: platforms update in the background.",
  regionLabel: "Country",
  regionSearch: "Search for a country",
  regionNoMatch: "No country matches.",
  regionCoveredOnly: "Only countries where TMDB lists platforms are offered.",
  regionProviders_one: "{{count}} platform listed in this country",
  regionProviders_other: "{{count}} platforms listed in this country",
  regionOptionProviders_one: "{{count}} platform",
  regionOptionProviders_other: "{{count}} platforms",
  regionNotCovered: "TMDB lists no platform in this country: chips and filters will stay empty.",
  regionCoverageUnknown: "Add a TMDB key to see covered countries and their platforms.",
  regionPreview: "Preview",
  regionPreviewMore_one: "and {{count}} more",
  regionPreviewMore_other: "and {{count}} more",
  regionRevert: "Revert",
  regionSavedToast: "Region saved: {{country}}. Platforms update in the background.",
} as const;
