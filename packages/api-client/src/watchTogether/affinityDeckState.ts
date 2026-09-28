import type { WtAffinityVerdict } from "@tentacle-tv/shared";
import type { SwipeCard } from "../swipe/swipeTypes";

/**
 * L'état d'une pile d'affinité côté client — le pendant de `swipeDeckState`
 * (« Affiner »), avec une différence : le SERVEUR sait ce que j'ai jugé, et
 * ne le resservira pas. Le client n'écarte donc que sa file et ce qu'il a
 * passé pendant ce tour — le serveur remettrait les titres passés en fin de
 * pile ; ils attendent qu'on demande à les revoir. Pur, testé sans React.
 */
export interface AffinityDeckState {
  queue: SwipeCard[];
  history: Array<{ card: SwipeCard; verdict: WtAffinityVerdict }>;
  /** Passés pendant ce tour, du plus ancien au plus récent. */
  skipped: string[];
  /** Le serveur n'a plus rien de neuf pour moi. */
  exhausted: boolean;
  /** Un premier lot est arrivé (sinon : chargement). */
  loaded: boolean;
}

export type AffinityDeckAction =
  | { type: "reset" }
  | { type: "loaded"; cards: SwipeCard[] }
  | { type: "judged"; verdict: WtAffinityVerdict }
  | { type: "undone" }
  | { type: "restore"; key: string }
  | { type: "revisit" };

/** Annulations possibles d'affilée. */
export const AFFINITY_HISTORY_MAX = 30;
/** Le serveur lit 60 clés d'exclusion : la file (≤ 14) plus ceux-là. */
export const AFFINITY_SKIPPED_MAX = 40;

export const INITIAL_AFFINITY_DECK: AffinityDeckState = {
  queue: [],
  history: [],
  skipped: [],
  exhausted: false,
  loaded: false,
};

function withoutKey(keys: readonly string[], key: string): string[] {
  return keys.filter((k) => k !== key);
}

export function affinityDeckReducer(state: AffinityDeckState, action: AffinityDeckAction): AffinityDeckState {
  switch (action.type) {
    case "reset":
      return INITIAL_AFFINITY_DECK;
    case "loaded": {
      const known = new Set([...state.queue.map((c) => c.key), ...state.skipped]);
      const fresh = action.cards.filter((c) => !known.has(c.key) && (known.add(c.key), true));
      return { ...state, queue: [...state.queue, ...fresh], exhausted: fresh.length === 0, loaded: true };
    }
    case "judged": {
      const [card, ...rest] = state.queue;
      if (!card) return state;
      const skipped = withoutKey(state.skipped, card.key);
      return {
        ...state,
        queue: rest,
        history: [...state.history, { card, verdict: action.verdict }].slice(-AFFINITY_HISTORY_MAX),
        skipped: action.verdict === "skip" ? [...skipped, card.key].slice(-AFFINITY_SKIPPED_MAX) : skipped,
      };
    }
    case "undone": {
      const last = state.history[state.history.length - 1];
      if (!last) return state;
      return {
        ...state,
        queue: [last.card, ...state.queue.filter((c) => c.key !== last.card.key)],
        history: state.history.slice(0, -1),
        skipped: withoutKey(state.skipped, last.card.key),
        exhausted: false,
      };
    }
    case "restore": {
      // L'enregistrement a échoué : la carte revient en haut, son geste sort
      // de l'historique.
      const index = state.history.map((h) => h.card.key).lastIndexOf(action.key);
      if (index < 0) return state;
      const entry = state.history[index];
      return {
        ...state,
        queue: [entry.card, ...state.queue.filter((c) => c.key !== action.key)],
        history: state.history.filter((_, i) => i !== index),
        skipped: withoutKey(state.skipped, action.key),
      };
    }
    case "revisit":
      return { ...state, skipped: [], exhausted: false };
  }
}

/** Les clés à passer au serveur pour ne rien recevoir en double. */
export function affinityExcludeKeys(state: AffinityDeckState): string[] {
  return [...state.queue.map((c) => c.key), ...state.skipped];
}
