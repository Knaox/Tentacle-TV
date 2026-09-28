// Notes explicites du moteur de recommandation (cf. hooks/useRatings)
export {
  useMyRatings, useItemRating, useRateItem, useDeleteRating, ratingKey,
  type RatingIdentity, type RatingMediaType, type UserRatingEntry, type RateItemInput,
} from "../hooks/useRatings";
export { useEndCardRating, type EndCardRating } from "../hooks/useEndCardRating";
// Identité de notation d'un item (film, série, épisode) — commune aux plateformes
export { tmdbIdForItem, ratingIdentityForItem, episodeRatingIdentityFor } from "../utils/ratingIdentity";
// Notes d'épisodes : identité, notes TMDB par saison, index des notes du compte
export {
  episodeRatingIdentity, episodeRatingsIndex, useMyEpisodeRatings, useTmdbSeasonEpisodes, TMDB_SEASON_KEY,
  type TmdbEpisodeRating,
} from "../hooks/useEpisodeRatings";

// Comptes externes — TMDB guest session (cf. hooks/useExternalAccounts)
export {
  useExternalAccounts, useCreateTmdbGuestSession, useUnlinkTmdbGuestSession, useResyncRatings,
  type ExternalAccountsStatus,
} from "../hooks/useExternalAccounts";
