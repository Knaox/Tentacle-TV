import { useCallback, useEffect, useReducer, useRef } from "react";
import { subscribeSocket } from "../../socket/tentacleSocket";
import {
  WT_CHAT_MAX_LENGTH, WT_CHAT_RATES, takeWtRateToken, type WtChatRateKind, type WtRateBucket,
} from "@tentacle-tv/shared";
import { useServerCapability } from "../../hooks/useServerCapabilities";
import { useWatchTogether } from "../context";
import { useWtTyping } from "./useWtTyping";
import { shouldRequestChatHistory } from "./chatHistoryRecovery";
import {
  chatReducer, initialChatState,
  type WtChatAction, type WtChatState,
} from "./chatState";

/**
 * Watch Together — hook du chat de groupe. Abonnement socket autonome
 * (indépendant de celui du Provider) filtrant wt:chat / wt:chatHistory /
 * wt:reaction / wt:gif / wt:typing. Pas d'insertion optimiste : l'écho
 * serveur fait foi (il porte l'id canonique et l'horodatage serveur).
 *
 * Interactif (20/10) : chaque envoi passe d'abord la MÊME règle de débit que
 * le serveur (`WT_CHAT_RATES`, seau à jetons) — une rafale passe, un geste
 * au-delà est refusé ICI (`false`) plutôt que perdu en silence là-bas ; les
 * rafales d'emojis identiques se regroupent à l'affichage (`count`).
 */

/** Attente du fil du groupe après l'entrée en salle, avant de le redemander (`wt:syncRequest`). */
export const WT_CHAT_HISTORY_WAIT_MS = 600;

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
  /** Faux : rien n'est parti (vide, ou au-delà du débit). */
  sendChat: (text: string) => boolean;
  sendReaction: (emoji: string) => boolean;
  sendGif: (gif: WtGifPayload) => boolean;
  setOpen: (open: boolean) => void;
  /** À chaque frappe dans le champ : « est en train d'écrire » chez les autres
   *  (serveur avec `watchTogether.typing` seulement). */
  notifyTyping: () => void;
}

export function useWtChat(): WtChatApi {
  const { room, selfId, send } = useWatchTogether();
  const groupId = room?.groupId ?? null;

  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  // Le groupe dont le fil est arrivé (`wt:chatHistory`) depuis que ce crochet écoute.
  const historyGroupRef = useRef<string | null>(null);
  // L'epoch de la salle, lu à l'entrée dans un groupe (sans relancer l'effet à chaque état).
  const epochRef = useRef(0);
  epochRef.current = room?.epoch ?? 0;
  const typingSupported = useServerCapability("watchTogether.typing");
  const { notifyTyping, sent } = useWtTyping(send, typingSupported && !!groupId, groupId);

  // Le débit, la même règle que le serveur : refuser ici plutôt que perdre là-bas.
  const ratesRef = useRef(new Map<WtChatRateKind, WtRateBucket>());
  const allow = useCallback((kind: WtChatRateKind): boolean => {
    const { allowed, bucket } = takeWtRateToken(ratesRef.current.get(kind), WT_CHAT_RATES[kind], Date.now());
    ratesRef.current.set(kind, bucket);
    return allowed;
  }, []);

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
          historyGroupRef.current = msg.groupId;
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
            reaction: { key, userId: msg.userId, username: msg.username, emoji: msg.emoji, addedAt: Date.now() },
          });
          scheduleExpiry({ type: "reaction_expire", key }, WT_REACTION_TTL_MS);
          break;
        }
        case "wt:typing":
          dispatch({ type: "typing", userId: msg.userId, username: msg.username, typing: msg.typing, now: Date.now() });
          break;
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
  //
  // Le serveur envoie ce fil AVEC l'adhésion (invitation acceptée, « Rejoindre
  // ici »), sur la socket — parfois AVANT que ce crochet n'écoute : la racine du
  // chat n'est montée qu'une fois la salle connue, par la réponse HTTP qui suit.
  // Vu à deux appareils du même compte (lot rf2) : le second rejoignait un groupe
  // de vingt-cinq messages avec un fil vide. Si le fil du groupe n'est pas arrivé
  // peu après, on le redemande par le geste du rechargement (`wt:syncRequest` :
  // l'état de la salle et son fil) — une fois par groupe, aucun message nouveau.
  // Jamais pour une salle qu'on vient de créer (`chatHistoryRecovery.ts`).
  useEffect(() => {
    dispatch({ type: "clear" });
    if (groupId === null) return undefined;
    const epochAtEntry = epochRef.current;
    const timer = setTimeout(() => {
      if (shouldRequestChatHistory({ groupId, epochAtEntry, receivedGroupId: historyGroupRef.current })) send({ type: "wt:syncRequest" });
    }, WT_CHAT_HISTORY_WAIT_MS);
    return () => clearTimeout(timer);
  }, [groupId, send]);

  const sendChat = useCallback((text: string) => {
    const trimmed = text.trim().slice(0, WT_CHAT_MAX_LENGTH);
    if (!trimmed || !allow("message")) return false;
    sent();
    return send({ type: "wt:chat", text: trimmed });
  }, [send, allow, sent]);

  const sendReaction = useCallback((emoji: string) => {
    return allow("reaction") && send({ type: "wt:reaction", emoji });
  }, [send, allow]);

  const sendGif = useCallback((gif: WtGifPayload) => {
    return allow("gif") && send({ type: "wt:gif", url: gif.url, w: gif.w, h: gif.h });
  }, [send, allow]);

  const setOpen = useCallback((open: boolean) => {
    dispatch({ type: "set_open", open });
  }, []);

  // « X est en train d'écrire » : chaque entrée s'éteint seule à son terme.
  const typingCount = state.typing.length;
  useEffect(() => {
    if (typingCount === 0) return;
    const prune = setInterval(() => dispatch({ type: "typing_prune", now: Date.now() }), 1_000);
    return () => clearInterval(prune);
  }, [typingCount]);

  return { state, sendChat, sendReaction, sendGif, setOpen, notifyTyping };
}
