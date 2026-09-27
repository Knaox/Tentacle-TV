import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { tentacleApiFetch } from "../hooks/usePreferences";
import { invalidateRecoQueries } from "../hooks/useRecoPage";
import { INITIAL_SWIPE_DECK, deckExcludeKeys, swipeDeckReducer } from "./swipeDeckState";
import type { SwipeCard, SwipeCardDetails, SwipeDeckResponse, SwipeLang, SwipeVerdict } from "./swipeTypes";

/** Taille d'un lot, et seuil de file sous lequel on en redemande un. */
const BATCH = 20;
const REFILL_AT = 6;

export interface SwipeDeck {
  /** La file : `cards[0]` est la carte du dessus. */
  cards: SwipeCard[];
  counts: SwipeDeckResponse["counts"];
  /** Faux : aucune clé TMDB, la pile vient de la bibliothèque seule. */
  tmdbConfigured: boolean;
  loading: boolean;
  error: boolean;
  /** Plus rien à juger (file vide ET serveur à sec). */
  empty: boolean;
  canUndo: boolean;
  /** Un verdict n'a pas pu être enregistré (la carte est revenue). */
  saveFailed: boolean;
  judge: (verdict: SwipeVerdict) => void;
  undo: () => void;
  retry: () => void;
  dismissSaveFailed: () => void;
}

/**
 * Une séance de l'onglet « Affiner ». Les écritures passent en SÉRIE (une
 * annulation ne double jamais le verdict qu'elle annule) ; la file se
 * recharge d'elle-même ; les recommandations sont invalidées en quittant.
 */
export function useSwipeDeck(lang: SwipeLang): SwipeDeck {
  const qc = useQueryClient();
  const [state, dispatch] = useReducer(swipeDeckReducer, INITIAL_SWIPE_DECK);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [tmdbConfigured, setTmdbConfigured] = useState(true);
  const stateRef = useRef(state);
  stateRef.current = state;
  const writes = useRef<Promise<unknown>>(Promise.resolve());
  const judgedAny = useRef(false);

  // Garde SYNCHRONE : l'état `fetching` n'est vu qu'au rendu suivant — deux
  // effets rapprochés (StrictMode, recharge + annulation) partaient chacun,
  // et le second lot, sans carte neuve, faisait croire la pile épuisée.
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setFetching(true);
    setError(false);
    try {
      const exclude = deckExcludeKeys(stateRef.current).join(",");
      const res = await tentacleApiFetch<SwipeDeckResponse>(
        `/api/swipe/deck?lang=${lang}&limit=${BATCH}&exclude=${encodeURIComponent(exclude)}`
      );
      setTmdbConfigured(res.tmdbConfigured);
      dispatch({ type: "loaded", cards: res.cards, counts: res.counts });
    } catch {
      setError(true);
    } finally {
      inFlight.current = false;
      setFetching(false);
    }
  }, [lang]);

  // Premier lot, puis recharge dès que la file baisse.
  const { queue, exhausted, loaded } = state;
  useEffect(() => {
    if (fetching || error) return;
    if (!loaded || (!exhausted && queue.length <= REFILL_AT)) void load();
  }, [queue.length, exhausted, loaded, fetching, error, load]);

  // En quittant l'onglet : les recommandations se relisent (le serveur a déjà
  // relancé le profil à chaque verdict).
  useEffect(() => () => {
    if (judgedAny.current) invalidateRecoQueries(qc);
  }, [qc]);

  const enqueue = useCallback((write: () => Promise<unknown>, onError?: () => void) => {
    writes.current = writes.current.then(write).catch(() => onError?.());
  }, []);

  const judge = useCallback((verdict: SwipeVerdict) => {
    const card = stateRef.current.queue[0];
    if (!card) return;
    judgedAny.current = true;
    dispatch({ type: "judged", verdict });
    enqueue(
      () => tentacleApiFetch("/api/swipe", {
        method: "POST",
        body: JSON.stringify({ mediaType: card.mediaType, tmdbId: card.tmdbId, verdict }),
      }),
      () => {
        dispatch({ type: "restore", key: card.key });
        setSaveFailed(true);
      }
    );
  }, [enqueue]);

  const undo = useCallback(() => {
    const last = stateRef.current.history[stateRef.current.history.length - 1];
    if (!last) return;
    dispatch({ type: "undone" });
    enqueue(() => tentacleApiFetch(`/api/swipe/${last.card.mediaType}/${last.card.tmdbId}`, { method: "DELETE" }));
  }, [enqueue]);

  const retry = useCallback(() => setError(false), []);
  const dismissSaveFailed = useCallback(() => setSaveFailed(false), []);

  return {
    cards: queue,
    counts: state.counts,
    tmdbConfigured,
    loading: !loaded && !error,
    error: error && queue.length === 0,
    empty: loaded && exhausted && queue.length === 0,
    canUndo: state.history.length > 0,
    saveFailed,
    judge,
    undo,
    retry,
    dismissSaveFailed,
  };
}

function detailsKey(card: SwipeCard, lang: SwipeLang) {
  return ["swipe", "details", card.key, lang] as const;
}

function fetchDetails(card: SwipeCard, lang: SwipeLang): Promise<SwipeCardDetails> {
  const item = card.jellyfinItemId ? `&itemId=${encodeURIComponent(card.jellyfinItemId)}` : "";
  return tentacleApiFetch<SwipeCardDetails>(`/api/swipe/details/${card.mediaType}/${card.tmdbId}?lang=${lang}${item}`);
}

/** Le verso d'une carte (synopsis, format) — mis en cache pour la séance. */
export function useSwipeCardDetails(card: SwipeCard | undefined, lang: SwipeLang, enabled = true) {
  return useQuery({
    queryKey: card ? detailsKey(card, lang) : ["swipe", "details", "none"],
    queryFn: () => fetchDetails(card as SwipeCard, lang),
    enabled: enabled && !!card,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
  });
}

/** Charge d'avance le verso de la carte suivante. */
export function prefetchSwipeCardDetails(qc: QueryClient, card: SwipeCard | undefined, lang: SwipeLang): void {
  if (!card) return;
  void qc.prefetchQuery({ queryKey: detailsKey(card, lang), queryFn: () => fetchDetails(card, lang), staleTime: Infinity });
}
