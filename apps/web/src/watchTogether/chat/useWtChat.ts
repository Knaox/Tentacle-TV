import { useCallback, useEffect, useReducer, useRef } from "react";
import { subscribeSocket } from "@tentacle-tv/api-client";
import { WT_CHAT_MAX_LENGTH } from "@tentacle-tv/shared";
import { useWatchTogether } from "../WatchTogetherProvider";
import {
  chatReducer, initialChatState,
  type WtChatAction, type WtChatState,
} from "./chatState";

/**
 * Watch Together — hook du chat de groupe. Abonnement socket autonome
 * (indépendant de celui du Provider) filtrant wt:chat / wt:chatHistory /
 * wt:reaction. Pas d'insertion optimiste : l'écho serveur fait foi (il porte
 * l'id canonique et l'horodatage serveur).
 */

/** Durée d'affichage d'une réaction flottante (animation ReactionLayer). */
export const WT_REACTION_TTL_MS = 2_600;
/** Durée d'affichage d'un GIF flottant (contenu à regarder → plus long). */
export const WT_GIF_TTL_MS = 4_200;
/** Durée d'affichage d'un aperçu de message reçu panneau fermé. */
export const WT_CHAT_TOAST_TTL_MS = 5_000;

/** GIF envoyable (URL tinygif issue du proxy /api/gifs). */
export interface WtGifPayload {
  url: string;
  w?: number;
  h?: number;
}

export interface WtChatApi {
  state: WtChatState;
  sendChat: (text: string) => void;
  sendReaction: (emoji: string) => void;
  sendGif: (gif: WtGifPayload) => void;
  setOpen: (open: boolean) => void;
}

export function useWtChat(): WtChatApi {
  const { room, selfId, send } = useWatchTogether();
  const groupId = room?.groupId ?? null;

  const [state, dispatch] = useReducer(chatReducer, initialChatState);

  // Refs stables pour le listener socket (souscription unique).
  const selfIdRef = useRef(selfId);
  selfIdRef.current = selfId;
  const groupIdRef = useRef(groupId);
  groupIdRef.current = groupId;

  // Timers de TTL des réactions + compteur de clés (deux réactions d'un même
  // membre dans la même milliseconde restent distinctes).
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const seqRef = useRef(0);

  const scheduleExpiry = useCallback((action: WtChatAction, delay: number) => {
    const timer = setTimeout(() => {
      timersRef.current.delete(timer);
      dispatch(action);
    }, delay);
    timersRef.current.add(timer);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeSocket((msg) => {
      switch (msg.type) {
        case "wt:chatHistory":
          dispatch({ type: "history", groupId: msg.groupId, messages: msg.messages });
          break;
        case "wt:chat": {
          dispatch({
            type: "message",
            message: msg.message,
            fromSelf: msg.message.userId === selfIdRef.current,
          });
          // Expiration inconditionnelle : sans effet si le reducer n'a pas
          // créé d'aperçu (panneau ouvert, message de soi, dédupe).
          scheduleExpiry({ type: "toast_expire", id: msg.message.id }, WT_CHAT_TOAST_TTL_MS);
          break;
        }
        case "wt:reaction": {
          const key = `${msg.userId}:${msg.at}:${seqRef.current++}`;
          dispatch({
            type: "reaction_add",
            reaction: { key, userId: msg.userId, username: msg.username, emoji: msg.emoji },
          });
          scheduleExpiry({ type: "reaction_expire", key }, WT_REACTION_TTL_MS);
          break;
        }
        case "wt:gif": {
          const key = `${msg.userId}:${msg.at}:g${seqRef.current++}`;
          dispatch({
            type: "reaction_add",
            reaction: {
              key, userId: msg.userId, username: msg.username,
              gif: { url: msg.url, w: msg.w, h: msg.h },
            },
          });
          scheduleExpiry({ type: "reaction_expire", key }, WT_GIF_TTL_MS);
          break;
        }
      }
    });
    const timers = timersRef.current;
    return () => {
      unsubscribe();
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
    };
  }, [scheduleExpiry]);

  // Changement / sortie de groupe : fil purgé (le wt:chatHistory du join
  // suivant repeuplera).
  useEffect(() => {
    dispatch({ type: "clear" });
  }, [groupId]);

  const sendChat = useCallback((text: string) => {
    const trimmed = text.trim().slice(0, WT_CHAT_MAX_LENGTH);
    if (!trimmed) return;
    send({ type: "wt:chat", text: trimmed });
  }, [send]);

  const sendReaction = useCallback((emoji: string) => {
    send({ type: "wt:reaction", emoji });
  }, [send]);

  const sendGif = useCallback((gif: WtGifPayload) => {
    send({ type: "wt:gif", url: gif.url, w: gif.w, h: gif.h });
  }, [send]);

  const setOpen = useCallback((open: boolean) => {
    dispatch({ type: "set_open", open });
  }, []);

  return { state, sendChat, sendReaction, sendGif, setOpen };
}
