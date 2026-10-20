import { WT_REACTION_GROUP_MS, WT_TYPING_TTL_MS, type WtChatMessageDto } from "@tentacle-tv/shared";

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
  /** La même réaction du même membre, en rafale : une seule, comptée (« 🔥 ×5 »). */
  count?: number;
  /** Arrivée (horloge locale) — le regroupement des rafales s'y lit. */
  addedAt?: number;
}

/** Un AUTRE membre qui tape, jusqu'à `expiresAt` (horloge locale). */
export interface WtTypingMember {
  userId: string;
  username: string;
  expiresAt: number;
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
  /** Les autres membres qui tapent (« X est en train d'écrire… »). */
  typing: WtTypingMember[];
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
  typing: [],
};

export type WtChatAction =
  | { type: "history"; groupId: string; messages: WtChatMessageDto[] }
  | { type: "message"; message: WtChatMessageDto; fromSelf: boolean }
  | { type: "reaction_add"; reaction: WtFloatingReaction }
  | { type: "reaction_expire"; key: string }
  | { type: "toast_expire"; id: string }
  | { type: "typing"; userId: string; username: string; typing: boolean; now: number }
  | { type: "typing_prune"; now: number }
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
        // Le message est parti : son auteur n'« écrit » plus.
        typing: state.typing.filter((m) => m.userId !== action.message.userId),
        messages: [...state.messages, action.message],
        unread: showToast ? state.unread + 1 : state.unread,
        toasts: showToast
          ? [...state.toasts, action.message].slice(-WT_CHAT_TOAST_MAX)
          : state.toasts,
      };
    }
    case "reaction_add":
      return { ...state, reactions: addReaction(state.reactions, action.reaction) };
    case "typing": {
      const others = state.typing.filter((m) => m.userId !== action.userId);
      if (!action.typing) return others.length === state.typing.length ? state : { ...state, typing: others };
      const entry = { userId: action.userId, username: action.username, expiresAt: action.now + WT_TYPING_TTL_MS };
      return { ...state, typing: [...others, entry] };
    }
    case "typing_prune": {
      const alive = state.typing.filter((m) => m.expiresAt > action.now);
      return alive.length === state.typing.length ? state : { ...state, typing: alive };
    }
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

/**
 * Une réaction de plus à l'écran. La MÊME réaction du même membre, arrivée
 * moins de WT_REACTION_GROUP_MS après la précédente encore à l'écran, la
 * remplace avec son compte + 1 (« 🔥 ×5 ») : une rafale s'enchaîne sans
 * remplir l'écran ni évincer celles des autres. Nouvelle clé : l'animation
 * repart, le compte saute aux yeux.
 */
function addReaction(reactions: WtFloatingReaction[], next: WtFloatingReaction): WtFloatingReaction[] {
  if (next.emoji && next.addedAt !== undefined) {
    let previous: WtFloatingReaction | undefined;
    for (let i = reactions.length - 1; i >= 0 && !previous; i -= 1) {
      if (reactions[i].userId === next.userId && reactions[i].emoji === next.emoji) previous = reactions[i];
    }
    if (previous?.addedAt !== undefined && next.addedAt - previous.addedAt < WT_REACTION_GROUP_MS) {
      const merged = { ...next, count: (previous.count ?? 1) + 1 };
      return [...reactions.filter((r) => r !== previous), merged].slice(-WT_FLOAT_MAX);
    }
  }
  return [...reactions, next].slice(-WT_FLOAT_MAX);
}
