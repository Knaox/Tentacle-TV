import type { WtAffinityVerdict } from "@tentacle-tv/shared";
import type { SwipeCard } from "../swipe/swipeTypes";

/**
 * L'état d'une pile d'affinité côté client — le pendant de `swipeDeckState`
 * (« Affiner »), avec une différence : le SERVEUR sait ce que j'ai jugé, et
 * ne le resservira pas. Le client n'écarte donc que sa file. Deux verdicts,
 * j'aime et pas pour moi : rien n'est « passé », rien ne revient. Pur, testé
 * sans React.
 */
export interface AffinityDeckState {
  queue: SwipeCard[];
  history: Array<{ card: SwipeCard; verdict: WtAffinityVerdict }>;
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
  | { type: "restore"; key: string };

/** Annulations possibles d'affilée. */
export const AFFINITY_HISTORY_MAX = 30;

export const INITIAL_AFFINITY_DECK: AffinityDeckState = {
  queue: [],
  history: [],
  exhausted: false,
  loaded: false,
};

export function affinityDeckReducer(state: AffinityDeckState, action: AffinityDeckAction): AffinityDeckState {
  switch (action.type) {
    case "reset":
      return INITIAL_AFFINITY_DECK;
    case "loaded": {
      const known = new Set(state.queue.map((c) => c.key));
      const fresh = action.cards.filter((c) => !known.has(c.key) && (known.add(c.key), true));
      return { ...state, queue: [...state.queue, ...fresh], exhausted: fresh.length === 0, loaded: true };
    }
    case "judged": {
      const [card, ...rest] = state.queue;
      if (!card) return state;
      return {
        ...state,
        queue: rest,
        history: [...state.history, { card, verdict: action.verdict }].slice(-AFFINITY_HISTORY_MAX),
      };
    }
    case "undone": {
      const last = state.history[state.history.length - 1];
      if (!last) return state;
      return {
        ...state,
        queue: [last.card, ...state.queue.filter((c) => c.key !== last.card.key)],
        history: state.history.slice(0, -1),
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
      };
    }
  }
}

/** Les clés à passer au serveur pour ne rien recevoir en double. */
export function affinityExcludeKeys(state: AffinityDeckState): string[] {
  return state.queue.map((c) => c.key);
}
