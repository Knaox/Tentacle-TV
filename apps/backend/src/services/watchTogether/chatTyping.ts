import type { JellyfinUser } from "../../middleware/auth";
import type { WsServerMessage } from "../wsManager";
import { sendToMember } from "./memberDevices";
import { WT_TYPING_TTL_MS } from "./protocol";
import type { Room } from "./roomTypes";
import { allowChat } from "./chatRate";

/**
 * Watch Together — « X est en train d'écrire… » (1.32.0, `watchTogether.typing`).
 *
 * Un message de protocole léger : le client dit `typing: true` à la frappe
 * (redit toutes les 2 s tant qu'il tape), puis `false` ; rien au repos. Le
 * serveur le relaie aux AUTRES membres — jamais au compte qui tape, sur aucun
 * de ses appareils — et l'éteint seul après WT_TYPING_TTL_MS sans nouvelle
 * (onglet fermé, réseau coupé). Envoyer un message l'éteint aussi.
 */

function relayTyping(room: Room, user: Pick<JellyfinUser, "userId" | "username">, typing: boolean): void {
  const msg: WsServerMessage = { type: "wt:typing", userId: user.userId, username: user.username, typing };
  for (const member of room.members.values()) {
    if (member.userId !== user.userId) sendToMember(member, msg);
  }
}

/** Un membre tape (ou a cessé). */
export function handleTyping(room: Room, user: JellyfinUser, typing: boolean): void {
  if (!typing) {
    stopTyping(room, user);
    return;
  }
  if (!allowChat(room, user.userId, "typing")) return;
  const previous = room.typing.get(user.userId);
  if (previous) clearTimeout(previous);
  room.typing.set(user.userId, setTimeout(() => {
    room.typing.delete(user.userId);
    relayTyping(room, user, false);
  }, WT_TYPING_TTL_MS));
  relayTyping(room, user, true);
}

/** Il ne tape plus (fin dite, message envoyé) : relayé seulement s'il tapait. */
export function stopTyping(room: Room, user: Pick<JellyfinUser, "userId" | "username">): void {
  const timer = room.typing.get(user.userId);
  if (!timer) return;
  clearTimeout(timer);
  room.typing.delete(user.userId);
  relayTyping(room, user, false);
}
