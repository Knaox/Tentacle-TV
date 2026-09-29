/**
 * The PUBLIC page of shared stats (/share/:token, no account needed) — in the
 * third person. Read BEFORE the `stats` namespace: a key with the same name
 * replaces the owner's wording ("Your genres" → "Genres"), the rest comes from
 * `stats`. `{{name}}` is the owner's name. Never gendered: "their", or the name.
 *
 * ⚠️ No "download" here: the phone mirror reads this page.
 */
export default {
  kicker: "Shared stats",
  title: "{{name}}'s stats",
  periodNote_30d: "Last 30 days",
  periodNote_year: "This year",
  periodNote_all: "All time",
  updated: "Figures as of {{date}}",
  readOnlyNote: "A public, read-only page: the numbers {{name}} chose to share, and nothing else. No movie or show can be played here.",
  footer: "Computed by Tentacle TV on a private server. Kept private: their viewing hours, screens, the exact dates of their sessions and their watchlist.",
  backToStats: "All stats",
  loading: "Loading stats…",

  heroLead_30d: "Over the last 30 days, {{name}} watched",
  heroLead_year: "This year, {{name}} watched",
  heroLead_all: "In total, {{name}} watched",
  sourceEstimated: "Estimated from their history",
  littleHistory: "A few more sessions and their profile will come into focus.",

  personaTitle: "Viewer profile",
  personaHint: "Drawn from their habits over the period",
  favoriteGenre: "Go-to genre",
  favoriteGenreDetail: "{{share}} of their time",
  badgeDetail_nightOwl: "{{share}} of their time between 10 pm and 5 am",
  badgeDetail_earlyBird: "{{share}} of their time before 10 am",
  badgeDetail_weekend: "{{share}} of their time on Saturdays and Sundays",
  badgeDetail_cinephile: "{{share}} of their time on movies",
  badgeDetail_seriesAddict: "{{share}} of their time on shows",
  badgeDetail_animeFan: "{{share}} of their time on anime",
  badgeDetail_loyal: "{{share}} of their time with {{label}}",
  badgeDetail_vintage: "{{share}} of their time on the {{label}}s",

  activityTitle: "Activity",
  momentsTitle: "What time of day?",
  momentsHint: "Share of the time measured by Tentacle, in {{name}}'s time zone",
  momentsHeadline_morning: "Mostly in the morning",
  momentsHeadline_afternoon: "Mostly in the afternoon",
  momentsHeadline_evening: "Mostly in the evening",
  momentsHeadline_night: "Mostly at night",
  moment_morning: "Morning",
  moment_afternoon: "Afternoon",
  moment_evening: "Evening",
  moment_night: "Night",
  momentRange_morning: "5 am – 12 pm",
  momentRange_afternoon: "12 pm – 6 pm",
  momentRange_evening: "6 pm – 11 pm",
  momentRange_night: "11 pm – 5 am",
  momentsWeekend: "Weekends",
  momentsWeekendLabel: "Saturday and Sunday",
  momentsEmpty: "Their habits will show up as Tentacle measures their viewing.",

  genresTitle: "Genres",
  originsHint: "The country where their titles were produced",
  seriesTitle: "Shows",
  moviesTitle: "Movies",
  moviesFavoritesTitle: "Favorite movies",
  moviesHint_preference: "Ranked by their rating, loves and favorites, then rewatches; time spent breaks ties.",
  moviesHint_time: "Ranked by time spent.",
  favoriteMovie: "Favorite movie",
  chipRating: "Their rating: {{rating}} out of 10",
  peopleTitle: "Headliners",
  peopleHint: "By number of titles they appear in, then time spent",
  decadesTitle: "Decades",
  recordsTitle: "Records",
  recordBingeDetail: "{{series}} · {{episodes}} episodes, {{date}}",
  recordSessionDetail: "Watching {{title}}, {{date}}",

  tasteTitle: "What {{name}} loves",
  tasteHint: "The titles that weigh the most in their taste",
  signalsTitle: "Opinions",
  tasteAnime: "{{share}} anime in their taste",

  aboutMeasured: "Since {{date}}, Tentacle clocks what {{name}} watches, whatever the app.",
  aboutCounts: "Watched movies and episodes come from their Jellyfin history.",
  aboutListening: "\"Dubbed or original?\" reads the audio track their apps report playing, recorded since {{date}}: nothing is inferred for earlier sessions.",
  aboutMoments: "Times of day follow {{name}}'s time zone, over the time measured by Tentacle.",

  emptyTitle: "{{name}} hasn't watched anything yet",
  emptyBody: "Their stats will show up here as they watch.",
  periodEmptyTitle: "Nothing watched in this period",
  periodEmptyBody: "{{name}} didn't watch anything in the shared period.",
} as const;
