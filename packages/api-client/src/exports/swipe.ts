// Onglet « Affiner » : pile de swipe (cf. swipe/)
export { useSwipeDeck, useSwipeCardDetails, prefetchSwipeCardDetails, type SwipeDeck } from "../swipe/useSwipeDeck";
export { swipeDeckReducer, deckExcludeKeys, INITIAL_SWIPE_DECK, type SwipeDeckState, type SwipeDeckAction } from "../swipe/swipeDeckState";
export {
  verdictFromDrag, stampStrength, exitTarget, DISTANCE_THRESHOLD, VELOCITY_THRESHOLD, FLICK_MIN_DISTANCE, STAMP_START,
} from "../swipe/swipeGesture";
export { swipeStackZ } from "../swipe/swipeStackOrder";
export {
  swipeLangOf, type SwipeCard, type SwipeCardDetails, type SwipeCounts, type SwipeDeckResponse, type SwipeDeckSource,
  type SwipeLang, type SwipeVerdict,
} from "../swipe/swipeTypes";

// Watch Together — l'affinité, le swipe de groupe (cf. watchTogether/)
export {
  fetchAffinity, fetchAffinityKinds, startAffinity, joinAffinity, leaveAffinity, fetchAffinityCards,
  voteAffinity, undoAffinityVote, launchAffinityMatch, isAffinityGone, type AffinityJoinResponse,
} from "../watchTogether/affinityApi";
export { useAffinityDeck, type AffinityDeck, type AffinityDeckEvents } from "../watchTogether/useAffinityDeck";
export {
  affinityDeckReducer, affinityExcludeKeys, INITIAL_AFFINITY_DECK, type AffinityDeckState, type AffinityDeckAction,
} from "../watchTogether/affinityDeckState";
