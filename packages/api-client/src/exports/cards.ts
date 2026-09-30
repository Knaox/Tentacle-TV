// Marqueurs des cartes média — note, ma liste, favori, vu (cf. hooks/useCardMarkers)
export { useCardMarkers, userScoreFromRatings, type CardMarkersOptions } from "../hooks/useCardMarkers";
export { useRecoMarkerItem, recoMarkerItem } from "../reco/useRecoMarkerItem";
// Survol unifié des cartes (cf. shared `cardOverlay.ts`) : bascules et cible
// de notation, les mêmes pour le survol web, la feuille mobile et la télécommande.
export { useCardToggles, type CardToggles } from "../hooks/useCardToggles";
export { useCardRatingTarget, type CardRatingTarget } from "../hooks/useCardRatingTarget";
export { useCardFace, cardFaceNeedsDetail } from "../hooks/useCardFace";
export { useSeriesRatings, SERIES_RATINGS_KEY } from "../hooks/useSeriesRatings";
