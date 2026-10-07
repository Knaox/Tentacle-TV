/**
 * The setup wizard: the TMDB key screen (optional, in both paths, right
 * before the review) and its line in the review. What the key really brings:
 * rich recommendations ("For you", taste profile, similar titles, cast), full
 * collections, streaming services and artwork for titles outside the
 * library. Merged into `setupWizard`.
 */
export default {
  step_tmdb: "TMDB key",
  tmdbTitle: "TMDB key (optional)",
  tmdbSubtitle: "The Movie Database adds to what Jellyfin knows about your movies and shows. A free key is all it takes.",
  tmdbBenefitsLabel: "With a key, Tentacle adds",
  tmdbBenefit_reco: "\"For you\" recommendations tailored to each account: similar titles, cast, tastes",
  tmdbBenefit_sagas: "Full collections, including the parts missing from your library",
  tmdbBenefit_providers: "Each title's streaming services, and filtering by service",
  tmdbBenefit_artwork: "Posters for titles outside your library",
  tmdbWithout: "Without a key, everything still works: recommendations fall back on your library's genres.",
  tmdbKeyLabel: "API key (v3)",
  tmdbKeyPlaceholder: "Paste the v3 API key",
  tmdbKeyShow: "Show the key",
  tmdbKeyHide: "Hide the key",
  tmdbKeyHintV4:
    "This looks like the v4 access token (\"API Read Access Token\"). Tentacle expects the v3 API key: 32 characters, just above on the same TMDB page.",
  tmdbKeyHintFormat: "A v3 key is 32 characters long: digits and the letters a to f.",
  tmdbGetKey: "Create a free key on themoviedb.org",
  tmdbSave: "Check and continue",
  tmdbChecking: "Checking with TMDB…",
  tmdbLater: "Set up later",
  tmdbLaterHint: "You'll add it in Administration › Metadata; the dashboard keeps it among its recommendations.",
  tmdbSaved: "TMDB key saved (ending in {{last4}}).",
  tmdbFromEnv: "TMDB key provided by the server's TMDB_API_KEY variable (ending in {{last4}}): nothing to enter.",
  tmdbReplace: "Use another key",
  recapTmdb: "TMDB key",
  recapTmdbSaved: "Saved (…{{last4}})",
  recapTmdbEnv: "Provided by the server (…{{last4}})",
  recapTmdbLater: "Later — Administration › Metadata",
};
