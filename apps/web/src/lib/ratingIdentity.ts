/**
 * L'identité de notation d'un item vit désormais dans `@tentacle-tv/api-client`
 * (`utils/ratingIdentity.ts`), partagée avec le mobile et la TV. Ce module
 * garde ses anciens noms pour ses importeurs du web.
 */
export { tmdbIdForItem, ratingIdentityForItem, episodeRatingIdentityFor } from "@tentacle-tv/api-client";
