import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { WtAffinityStateDto, WtAffinityVerdict } from "@tentacle-tv/shared";
import type { SwipeCard } from "../swipe/swipeTypes";
import { fetchAffinityCards, isAffinityGone, joinAffinity, undoAffinityVote, voteAffinity } from "./affinityApi";
import { INITIAL_AFFINITY_DECK, affinityDeckReducer, affinityExcludeKeys } from "./affinityDeckState";

/** Taille d'un lot, et seuil de file sous lequel on en redemande un — petit :
 *  ce que les autres viennent d'aimer passe devant au lot suivant. */
const BATCH = 10;
const REFILL_AT = 4;

export interface AffinityDeck {
  /** La file : `cards[0]` est la carte du dessus. */
  cards: SwipeCard[];
  loading: boolean;
  error: boolean;
  /** Plus rien à juger pour l'instant (file vide ET serveur à sec). */
  empty: boolean;
  canUndo: boolean;
  /** Un geste n'a pas pu être enregistré (la carte est revenue). */
  saveFailed: boolean;
  judge: (verdict: WtAffinityVerdict) => void;
  undo: () => void;
  retry: () => void;
  dismissSaveFailed: () => void;
}

export interface AffinityDeckEvents {
  /** La séance tenue n'est plus celle du serveur : relire l'état. */
  onGone?: () => void;
  /** Mon verdict vient de faire un match : l'état qui le porte (le socket
   *  le dira aussi, peut-être avant). */
  onMatch?: (state: WtAffinityStateDto) => void;
}

/**
 * Ma pile dans une séance d'affinité. Tout passe en SÉRIE — rejoindre, les
 * recharges, les votes, les annulations : une recharge part toujours après
 * les votes qui la précèdent, le serveur ne ressert donc jamais une carte
 * dont le verdict est encore en route. Un changement de séance repart de zéro.
 */
export function useAffinityDeck(sessionId: number | null, events: AffinityDeckEvents = {}): AffinityDeck {
  const [state, dispatch] = useReducer(affinityDeckReducer, INITIAL_AFFINITY_DECK);
  const [error, setError] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  /** « Réessayer » avant tout premier lot : on rejoint de nouveau. */
  const [joinAttempt, setJoinAttempt] = useState(0);
  const stateRef = useRef(state);
  stateRef.current = state;
  const eventsRef = useRef(events);
  eventsRef.current = events;
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  /** Une séance = une génération : ce qui revient d'une séance quittée est jeté. */
  const generation = useRef(0);
  // Garde SYNCHRONE : l'état n'est vu qu'au rendu suivant (cf. useSwipeDeck).
  const refilling = useRef(false);

  const enqueue = useCallback((task: () => Promise<unknown>, onError: (err: unknown) => void) => {
    chain.current = chain.current.then(task).catch(onError);
  }, []);

  const fail = useCallback((err: unknown) => {
    if (isAffinityGone(err)) eventsRef.current.onGone?.();
    else setError(true);
  }, []);

  useEffect(() => {
    const gen = ++generation.current;
    dispatch({ type: "reset" });
    setError(false);
    if (sessionId === null) return;
    enqueue(async () => {
      const res = await joinAffinity(BATCH);
      if (gen !== generation.current) return;
      if (res.sessionId !== sessionId) eventsRef.current.onGone?.();
      else dispatch({ type: "loaded", cards: res.cards });
    }, (err) => gen === generation.current && fail(err));
  }, [sessionId, joinAttempt, enqueue, fail]);

  const { queue, exhausted, loaded } = state;
  useEffect(() => {
    if (sessionId === null || !loaded || exhausted || error || refilling.current || queue.length > REFILL_AT) return;
    const gen = generation.current;
    refilling.current = true;
    enqueue(async () => {
      try {
        const cards = await fetchAffinityCards(sessionId, BATCH, affinityExcludeKeys(stateRef.current));
        if (gen === generation.current) dispatch({ type: "loaded", cards });
      } finally {
        refilling.current = false;
      }
    }, (err) => gen === generation.current && fail(err));
  }, [sessionId, queue.length, exhausted, loaded, error, enqueue, fail]);

  const judge = useCallback((verdict: WtAffinityVerdict) => {
    const card = stateRef.current.queue[0];
    if (!card || sessionId === null) return;
    const gen = generation.current;
    dispatch({ type: "judged", verdict });
    enqueue(async () => {
      const { matched, state: after } = await voteAffinity(sessionId, card.key, verdict);
      if (matched && gen === generation.current) eventsRef.current.onMatch?.(after);
    }, (err) => {
      if (gen !== generation.current) return;
      if (isAffinityGone(err)) {
        eventsRef.current.onGone?.();
        return;
      }
      dispatch({ type: "restore", key: card.key });
      setSaveFailed(true);
    });
  }, [sessionId, enqueue]);

  const undo = useCallback(() => {
    const last = stateRef.current.history[stateRef.current.history.length - 1];
    if (!last || sessionId === null) return;
    const gen = generation.current;
    dispatch({ type: "undone" });
    enqueue(() => undoAffinityVote(sessionId, last.card.key), (err) => {
      if (gen === generation.current && isAffinityGone(err)) eventsRef.current.onGone?.();
    });
  }, [sessionId, enqueue]);

  const retry = useCallback(() => {
    if (!stateRef.current.loaded) setJoinAttempt((n) => n + 1);
    else setError(false);
  }, []);
  const dismissSaveFailed = useCallback(() => setSaveFailed(false), []);

  return {
    cards: queue,
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
