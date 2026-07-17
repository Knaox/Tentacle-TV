import type { JellyfinUser } from "../../middleware/auth";
import { sendToUser } from "../wsManager";
import type { Room } from "./roomStore";
import {
  WT_CHAT_HISTORY_SIZE,
  WT_MIN_CHAT_INTERVAL_MS,
  WT_MIN_GIF_INTERVAL_MS,
  WT_MIN_REACTION_INTERVAL_MS,
  type WtChatMessageDto,
} from "./protocol";

/**
 * Watch Together — chat de groupe et réactions emoji.
 *
 * Événements TRANSIENTS (comme wt:autonextDismiss) : hors wt:state, aucun
 * bump d'epoch. Le fil est un ring buffer en mémoire dans la Room
 * (WT_CHAT_HISTORY_SIZE), renvoyé au join et à chaque syncRequest.
 * La validation de forme (trim, longueurs) est faite par parseWtClientMessage ;
 * ici : anti-spam + diffusion. Un envoi trop rapproché est silencieusement
 * ignoré (pas de wt:error — le spam ne mérite pas de feedback).
 */

/** Diffuse un message serveur à TOUS les membres de la room (émetteur inclus —
 *  l'écho sert d'accusé de réception côté client). */
function broadcastToMembers(room: Room, msg: Parameters<typeof sendToUser>[1]): void {
  for (const memberId of room.members.keys()) {
    sendToUser(memberId, msg);
  }
}

/** Message texte : rate limit, ajout au fil, diffusion. */
export function handleChat(room: Room, user: JellyfinUser, text: string): void {
  const now = Date.now();
  const last = room.lastChatAt.get(user.userId) ?? 0;
  if (now - last < WT_MIN_CHAT_INTERVAL_MS) return;
  room.lastChatAt.set(user.userId, now);

  const message: WtChatMessageDto = {
    id: `${room.groupId}:${++room.chatSeq}`,
    userId: user.userId,
    username: user.username,
    text,
    at: now,
  };
  room.chat.push(message);
  if (room.chat.length > WT_CHAT_HISTORY_SIZE) room.chat.shift();

  broadcastToMembers(room, { type: "wt:chat", message });
}

/** Réaction emoji : rate limit, diffusion. Transient, jamais stockée. */
export function handleReaction(room: Room, user: JellyfinUser, emoji: string): void {
  const now = Date.now();
  const last = room.lastReactionAt.get(user.userId) ?? 0;
  if (now - last < WT_MIN_REACTION_INTERVAL_MS) return;
  room.lastReactionAt.set(user.userId, now);

  broadcastToMembers(room, {
    type: "wt:reaction",
    userId: user.userId,
    username: user.username,
    emoji,
    at: now,
  });
}

/** GIF éphémère : rate limit dédié (plus strict que l'emoji — un GIF est
 *  visuellement lourd), diffusion. Transient, jamais stocké. L'URL a déjà été
 *  validée par parseWtClientMessage (https + allowlist d'hôtes Klipy). */
export function handleGif(
  room: Room,
  user: JellyfinUser,
  gif: { url: string; w?: number; h?: number },
): void {
  const now = Date.now();
  const last = room.lastGifAt.get(user.userId) ?? 0;
  if (now - last < WT_MIN_GIF_INTERVAL_MS) return;
  room.lastGifAt.set(user.userId, now);

  broadcastToMembers(room, {
    type: "wt:gif",
    userId: user.userId,
    username: user.username,
    url: gif.url,
    w: gif.w,
    h: gif.h,
    at: now,
  });
}

/** Envoie le fil complet à UN membre (join, syncRequest). Envoyé même vide :
 *  le client remet son état de chat à zéro sur ce message. */
export function sendChatHistory(userId: string, room: Room): void {
  sendToUser(userId, { type: "wt:chatHistory", groupId: room.groupId, messages: room.chat });
}
