import type { SwipeCard, SwipeCounts, SwipeVerdict } from "./swipeTypes";

/**
 * L'état d'une séance de swipe, commun au web et au mobile : la file (la
 * carte du dessus en tête), l'historique qui permet d'annuler, les clés déjà
 * jugées pendant la séance (le serveur ne doit pas les resservir avant d'avoir
 * reçu leur verdict) et les compteurs affichés. Pur — testé sans React.
 */
export interface SwipeDeckState {
  queue: SwipeCard[];
  history: Array<{ card: SwipeCard; verdict: SwipeVerdict }>;
  seen: string[];
  counts: SwipeCounts;
  /** Le serveur n'a plus rien de neuf à proposer. */
  exhausted: boolean;
  /** Un premier lot est arrivé (sinon : chargement initial). */
  loaded: boolean;
}

export type SwipeDeckAction =
  | { type: "loaded"; cards: SwipeCard[]; counts?: SwipeCounts }
  | { type: "judged"; verdict: SwipeVerdict }
  | { type: "undone" }
  | { type: "restore"; key: string };

/** Annulations possibles d'affilée. */
export const HISTORY_MAX = 30;
/** Clés jugées retenues pour l'exclusion (au-delà, le serveur les connaît). */
export const SEEN_MAX = 60;

export const EMPTY_COUNTS: SwipeCounts = { like: 0, superlike: 0, dislike: 0, skip: 0 };

export const INITIAL_SWIPE_DECK: SwipeDeckState = {
  queue: [],
  history: [],
  seen: [],
  counts: EMPTY_COUNTS,
  exhausted: false,
  loaded: false,
};

function bump(counts: SwipeCounts, verdict: SwipeVerdict, delta: 1 | -1): SwipeCounts {
  return { ...counts, [verdict]: Math.max(0, counts[verdict] + delta) };
}

export function swipeDeckReducer(state: SwipeDeckState, action: SwipeDeckAction): SwipeDeckState {
  switch (action.type) {
    case "loaded": {
      const known = new Set([...state.queue.map((c) => c.key), ...state.seen]);
      const fresh = action.cards.filter((c) => !known.has(c.key) && (known.add(c.key), true));
      return {
        ...state,
        queue: [...state.queue, ...fresh],
        // Les compteurs du serveur ne valent qu'au premier lot : ensuite, la
        // séance les tient à jour elle-même (sinon, double comptage).
        counts: !state.loaded && action.counts ? action.counts : state.counts,
        exhausted: fresh.length === 0,
        loaded: true,
      };
    }
    case "judged": {
      const [card, ...rest] = state.queue;
      if (!card) return state;
      return {
        ...state,
        queue: rest,
        history: [...state.history, { card, verdict: action.verdict }].slice(-HISTORY_MAX),
        seen: [...state.seen.filter((k) => k !== card.key), card.key].slice(-SEEN_MAX),
        counts: bump(state.counts, action.verdict, 1),
      };
    }
    case "undone": {
      const last = state.history[state.history.length - 1];
      if (!last) return state;
      return {
        ...state,
        queue: [last.card, ...state.queue.filter((c) => c.key !== last.card.key)],
        history: state.history.slice(0, -1),
        seen: state.seen.filter((k) => k !== last.card.key),
        counts: bump(state.counts, last.verdict, -1),
        exhausted: false,
      };
    }
    case "restore": {
      // L'enregistrement a échoué : la carte revient en haut, son verdict sort
      // de l'historique et des compteurs.
      const index = state.history.map((h) => h.card.key).lastIndexOf(action.key);
      if (index < 0) return state;
      const entry = state.history[index];
      return {
        ...state,
        queue: [entry.card, ...state.queue.filter((c) => c.key !== action.key)],
        history: state.history.filter((_, i) => i !== index),
        seen: state.seen.filter((k) => k !== action.key),
        counts: bump(state.counts, entry.verdict, -1),
      };
    }
  }
}

/** Les clés à passer au serveur pour ne rien recevoir en double. */
export function deckExcludeKeys(state: SwipeDeckState): string[] {
  return [...state.queue.map((c) => c.key), ...state.seen];
}
