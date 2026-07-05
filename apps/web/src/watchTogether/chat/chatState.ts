import type { WtChatMessageDto } from "@tentacle-tv/shared";

/**
 * Watch Together — état du chat de groupe (reducer pur, hors React).
 * Alimenté par useWtChat depuis le socket partagé ; indépendant de wtEvents
 * (le fil de chat n'a ni epoch ni rapport avec l'état de lecture).
 */

/** Réaction emoji éphémère en cours d'animation (purgée par TTL). */
export interface WtFloatingReaction {
  /** Clé d'animation unique (userId:at:n). */
  key: string;
  userId: string;
  username: string;
  emoji: string;
}

export interface WtChatState {
  /** Groupe auquel appartient le fil (garde anti-stale au changement). */
  groupId: string | null;
  messages: WtChatMessageDto[];
  /** Messages d'autrui reçus panneau fermé. */
  unread: number;
  open: boolean;
  reactions: WtFloatingReaction[];
}

export const initialChatState: WtChatState = {
  groupId: null,
  messages: [],
  unread: 0,
  open: false,
  reactions: [],
};

export type WtChatAction =
  | { type: "history"; groupId: string; messages: WtChatMessageDto[] }
  | { type: "message"; message: WtChatMessageDto; fromSelf: boolean }
  | { type: "reaction_add"; reaction: WtFloatingReaction }
  | { type: "reaction_expire"; key: string }
  | { type: "set_open"; open: boolean }
  | { type: "clear" };

export function chatReducer(state: WtChatState, action: WtChatAction): WtChatState {
  switch (action.type) {
    case "history":
      // Fil canonique du serveur (join, F5/syncRequest) — remplace tout,
      // y compris un fil vide (reset au re-join d'un nouveau groupe).
      return {
        ...state,
        groupId: action.groupId,
        messages: action.messages,
        unread: state.open ? 0 : state.unread,
      };
    case "message": {
      // Dédupe par id : l'historique reçu à la reconnexion peut recouvrir un
      // message déjà poussé en temps réel (et inversement).
      if (state.messages.some((m) => m.id === action.message.id)) return state;
      return {
        ...state,
        messages: [...state.messages, action.message],
        unread: !state.open && !action.fromSelf ? state.unread + 1 : state.unread,
      };
    }
    case "reaction_add":
      return { ...state, reactions: [...state.reactions, action.reaction] };
    case "reaction_expire":
      return { ...state, reactions: state.reactions.filter((r) => r.key !== action.key) };
    case "set_open":
      return { ...state, open: action.open, unread: action.open ? 0 : state.unread };
    case "clear":
      return initialChatState;
    default:
      return state;
  }
}
