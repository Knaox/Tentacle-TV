import type { WtChatMessageDto } from "@tentacle-tv/shared";

/**
 * Watch Together — état du chat de groupe (reducer pur, hors React).
 * Alimenté par useWtChat depuis le socket partagé ; indépendant de wtEvents
 * (le fil de chat n'a ni epoch ni rapport avec l'état de lecture).
 */

/** Réaction éphémère en cours d'animation (purgée par TTL) : emoji OU gif. */
export interface WtFloatingReaction {
  /** Clé d'animation unique (userId:at:n). */
  key: string;
  userId: string;
  username: string;
  /** Un seul des deux est renseigné. */
  emoji?: string;
  gif?: { url: string; w?: number; h?: number };
}

export interface WtChatState {
  /** Groupe auquel appartient le fil (garde anti-stale au changement). */
  groupId: string | null;
  messages: WtChatMessageDto[];
  /** Messages d'autrui reçus panneau fermé. */
  unread: number;
  open: boolean;
  reactions: WtFloatingReaction[];
  /** Aperçus éphémères des messages d'autrui reçus panneau fermé (affichés
   *  discrètement à l'écran comme les réactions, purgés par TTL). */
  toasts: WtChatMessageDto[];
}

/** Nombre max d'aperçus empilés simultanément. */
export const WT_CHAT_TOAST_MAX = 4;

/** Cap de réactions flottantes simultanées (spam multi-membres) : au-delà, les
 *  plus anciennes sont évincées — leur timer d'expiration devient un filter
 *  sans effet, inoffensif. */
export const WT_FLOAT_MAX = 40;

export const initialChatState: WtChatState = {
  groupId: null,
  messages: [],
  unread: 0,
  open: false,
  reactions: [],
  toasts: [],
};

export type WtChatAction =
  | { type: "history"; groupId: string; messages: WtChatMessageDto[] }
  | { type: "message"; message: WtChatMessageDto; fromSelf: boolean }
  | { type: "reaction_add"; reaction: WtFloatingReaction }
  | { type: "reaction_expire"; key: string }
  | { type: "toast_expire"; id: string }
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
      const showToast = !state.open && !action.fromSelf;
      return {
        ...state,
        messages: [...state.messages, action.message],
        unread: showToast ? state.unread + 1 : state.unread,
        toasts: showToast
          ? [...state.toasts, action.message].slice(-WT_CHAT_TOAST_MAX)
          : state.toasts,
      };
    }
    case "reaction_add":
      return { ...state, reactions: [...state.reactions, action.reaction].slice(-WT_FLOAT_MAX) };
    case "reaction_expire":
      return { ...state, reactions: state.reactions.filter((r) => r.key !== action.key) };
    case "toast_expire":
      return { ...state, toasts: state.toasts.filter((m) => m.id !== action.id) };
    case "set_open":
      // Ouverture : les aperçus deviennent redondants avec le fil visible.
      return {
        ...state,
        open: action.open,
        unread: action.open ? 0 : state.unread,
        toasts: action.open ? [] : state.toasts,
      };
    case "clear":
      return initialChatState;
    default:
      return state;
  }
}
