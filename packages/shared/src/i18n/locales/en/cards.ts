/**
 * Media cards: status markers and hover-revealed actions.
 *
 * Read by EVERY platform, mobile included: no word of the "download" family
 * here (Apple review rule, see `offline.ts`).
 */
export default {
  communityRating: "Community rating {{score}} out of 10",
  userRating: "Your rating {{score}} out of 10",
  status: {
    watchlist: "In my list",
    favorite: "In favorites",
    watched: "Watched",
  },

  play: "Play",
  resume: "Resume",
  moreInfo: "More info",
  addToWatchlist: "Add to my list",
  removeFromWatchlist: "Remove from my list",
  addToFavorites: "Add to favorites",
  removeFromFavorites: "Remove from favorites",
  markWatched: "Mark as watched",
  markUnwatched: "Mark as unwatched",

  rateTitle: "Rate this title",
  rateHint: "Tap a star — its left half counts as half a star.",
  ratedHint: "Tap your rating again to remove it.",
  ratingUnavailable: "This title can't be rated: it has no TMDB identifier.",
} as const;
