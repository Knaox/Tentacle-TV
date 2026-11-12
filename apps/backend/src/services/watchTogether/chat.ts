import type { JellyfinUser } from "../../middleware/auth";
import type { WsServerMessage } from "../wsManager";
import { sendToMember, sendToRoom } from "./memberDevices";
import type { Room } from "./roomTypes";
import { WT_CHAT_ADMIN_ID, WT_CHAT_HISTORY_SIZE, type WtChatMessageDto } from "./protocol";
import { allowChat } from "./chatRate";
import { stopTyping } from "./chatTyping";

/**
 * Watch Together — chat de groupe et réactions emoji.
 *
 * Événements TRANSIENTS (comme wt:autonextDismiss) : hors wt:state, aucun
 * bump d'epoch. Le fil est un ring buffer en mémoire dans la Room
 * (WT_CHAT_HISTORY_SIZE), renvoyé au join et à chaque syncRequest.
 * La validation de forme (trim, longueurs) est faite par parseWtClientMessage ;
 * ici : débit (`chatRate.ts` : une rafale, puis un rythme soutenu — un vrai
 * enchaînement passe) + diffusion. Au-delà, ignoré en silence (pas de
 * wt:error — le spam ne mérite pas de feedback).
 */

/** Diffuse un message serveur à TOUS les membres de la room (émetteur inclus —
 *  l'écho sert d'accusé de réception côté client). */
function broadcastToMembers(room: Room, msg: WsServerMessage): void {
  // Aux appareils liés seulement (1.31.1, adhésion par appareil).
  sendToRoom(room, msg);
}

/** Message texte : rate limit, ajout au fil, diffusion. */
export function handleChat(room: Room, user: JellyfinUser, text: string): void {
  const now = Date.now();
  if (!allowChat(room, user.userId, "message", now)) return;
  // Le message part : « est en train d'écrire » s'éteint chez les autres.
  stopTyping(room, user);

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

/**
 * Un message de l'ADMINISTRATION (tableau de bord des sessions, `sessions.groupChat`) : dans le
 * fil comme un message — à chaque appareil lié, en lecture ou non, gardé pour l'historique —, mais
 * d'aucun membre (`WT_CHAT_ADMIN_ID`), même si l'administrateur est dans la salle. Aucun débit :
 * la route est réservée à l'administration.
 */
export function postAdminChat(room: Room, author: string, content: { header: string; text: string }): WtChatMessageDto {
  const header = content.header.trim();
  const message: WtChatMessageDto = {
    id: `${room.groupId}:${++room.chatSeq}`,
    userId: WT_CHAT_ADMIN_ID,
    username: author,
    text: content.text,
    at: Date.now(),
    from: "admin",
    ...(header ? { header } : {}),
  };
  room.chat.push(message);
  if (room.chat.length > WT_CHAT_HISTORY_SIZE) room.chat.shift();
  broadcastToMembers(room, { type: "wt:chat", message });
  return message;
}

/** Réaction emoji : rate limit, diffusion. Transient, jamais stockée. */
export function handleReaction(room: Room, user: JellyfinUser, emoji: string): void {
  const now = Date.now();
  if (!allowChat(room, user.userId, "reaction", now)) return;

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
  if (!allowChat(room, user.userId, "gif", now)) return;

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
  const member = room.members.get(userId);
  if (member) sendToMember(member, { type: "wt:chatHistory", groupId: room.groupId, messages: room.chat });
}
