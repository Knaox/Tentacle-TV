// Feedback, démarrage à froid, relance du profil (cf. hooks/useRecoRows)
export {
  useSendRecoFeedback, useColdStartTitles, useRecoWarmup,
  type RecoState, type RecoReason, type RecoRowItem, type RecoFeedbackAction, type ColdStartTitle,
} from "../hooks/useRecoRows";
export type { RecoProviderRef } from "../hooks/recoTypes";

// La page de recommandations en UNE requête, et son fil temps réel
// (cf. hooks/useRecoPage, hooks/useRecoLive)
export {
  useRecoPage, prefetchRecoPage, removeRecoItem, dropRecoItemEverywhere, invalidateRecoQueries, normalizeProviderFilter,
  recoFilterKey, getRecoPageKey, RECO_PAGE_KEY, ALL_PROVIDERS_KEY, type RecoPage, type RecoPageRow,
} from "../hooks/useRecoPage";
export { useRecoLive } from "../hooks/useRecoLive";

// Un titre jugé (Ma liste, cœur, vu, note) sort des recommandations quand la
// carte est LÂCHÉE — fin du survol de sa rangée, feuille refermée (cf.
// reco/recoRetirement, reco/useRecoHold)
export { useRecoHold, useRecoCardHold, useHeldRecoItems } from "../reco/useRecoHold";

// Images, titres et état TMDB des recommandations, partagés par les clients
// (cf. reco/recoImages, reco/recoRowTitles, hooks/useAdminMetadata)
export {
  recoPosterUrl, recoHaloSourceUrl, recoBackdropUrl, recoAmbilightSourceUrl, type TmdbPosterSize, type TmdbBackdropSize,
} from "../reco/recoImages";
export { RECO_ROW_TITLE_KEYS, recoRowTitle, type RecoRowTitle } from "../reco/recoRowTitles";
export {
  useAdminMetadataStatus, useUpdateAdminMetadata, useTestTmdbKey, useAdminMetadataRegions, useAdminRegionProviders,
  adminMetadataErrorCode, fanoutRefetchInterval, ADMIN_METADATA_KEY, ADMIN_METADATA_REGIONS_KEY, FANOUT_POLL_MS,
  type AdminMetadataStatus, type AdminRecoFanout, type AdminMetadataUpdate, type AdminMetadataErrorCode,
  type AdminProviderRegion, type TmdbKeyTestResult,
} from "../hooks/useAdminMetadata";

// Personnes aimées — rangées « Avec {acteur} » (cf. hooks/useLikedPeople)
export {
  useLikedPeople, useLikePerson, useUnlikePerson, usePersonSearch, usePersonSuggestions,
  type LikedPerson, type PersonSearchResult,
} from "../hooks/useLikedPeople";

// Annuaire des plateformes de streaming (cf. hooks/useWatchProviders)
export {
  useWatchProviders, prefetchWatchProviders, WATCH_PROVIDERS_KEY, type WatchProviderDirectory, type WatchProviderEntry,
} from "../hooks/useWatchProviders";

// Reco partagés entre web, mobile et TV : raisons verbalisées, tirage des
// diapositives héros, catalogue des familles de plateformes (cf. src/reco).
export { reasonToText, type ReasonTranslate } from "../reco/recoReasonText";
export { selectHeroSlides, heroSelectionFromRows, useRecoHeroSlides, type RecoHeroSelection } from "../reco/recoHeroSlides";
export { buildPlatformCatalog, isFamilyActive, toggleFamily, activeFamilyCount, type PlatformCatalogEntry } from "../reco/platformCatalog";
