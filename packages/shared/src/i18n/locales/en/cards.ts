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
    // « Sur cet appareil » (bureau, mobile) : le titre gardé, ou des épisodes d'une série.
    onDevice: "On this device",
    onDeviceSome: "Episodes on this device",
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

  // Unified hover (`cardOverlay.ts`): tray extras, and action sheets.
  dismiss: "Not for me",
  keepOffline: "Keep offline",

  // Out-of-library cards (`externalCardOverlay.ts`): My list on arrival, and
  // what to say when the request extension doesn't follow.
  addToWatchlistOnArrival: "Add to my list when it arrives",
  removeFromWatchlistOnArrival: "Don't add it when it arrives",
  watchlistOnArrival: "In my list once it arrives",
  requestSent: "Request sent.",
  requestFailed: "The request didn't go through.",
  watchlistAdded: "Added to my list.",
  watchlistOnArrivalAdded: "It will join my list as soon as it arrives.",
  watchlistFailed: "My list couldn't be updated.",
} as const;
