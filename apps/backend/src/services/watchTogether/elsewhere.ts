import { sendToDevices, sendToOtherDevices } from "../wsManager";
import { getRoomOf } from "./roomRegistry";
import type { Room } from "./roomTypes";
import type { WtElsewhereDto } from "./protocol";

/**
 * Watch Together — l'avis « Groupe en cours sur un autre appareil »
 * (1.31.1, adhésion par appareil). Un appareil NON lié d'un compte membre ne
 * reçoit rien de la séance ; il apprend seulement qu'elle existe, pour
 * proposer discrètement « Rejoindre ici » (`POST /group/join-here`, qui
 * AJOUTE cet appareil). L'avis part à chaque changement qui le modifie
 * (entrée, départ, titre, hôte, appareils) et à la connexion d'un appareil ;
 * `null` quand le compte n'est plus dans aucune salle.
 */

/** L'avis pour un appareil du compte — null s'il est lié (il EST dans la salle)
 *  ou si le compte n'est dans aucune salle. Un membre sans appareil lié
 *  (comportement d'avant) : tout le compte est dans la salle, pas d'avis. */
export function elsewhereFor(userId: string, deviceKey?: string): WtElsewhereDto | null {
  const room = getRoomOf(userId);
  const member = room?.members.get(userId);
  if (!room || !member || member.devices.size === 0) return null;
  if (deviceKey !== undefined && member.devices.has(deviceKey)) return null;
  return {
    groupId: room.groupId,
    hostUsername: room.members.get(room.hostUserId)?.username ?? "",
    hostUserId: room.hostUserId,
    itemId: room.itemId,
    memberCount: room.members.size,
    deviceCount: member.devices.size,
  };
}

/** Redit l'avis aux appareils non liés du compte (null : plus de salle). */
export function notifyElsewhere(userId: string): void {
  const member = getRoomOf(userId)?.members.get(userId);
  sendToOtherDevices(userId, member?.devices ?? new Map(), { type: "wt:elsewhere", elsewhere: elsewhereFor(userId) });
}

/** Redit l'avis à tous les membres d'une salle (titre, hôte, composition). */
export function notifyElsewhereRoom(room: Room): void {
  for (const userId of room.members.keys()) notifyElsewhere(userId);
}

/** Un appareil vient de se connecter : s'il n'est pas lié, l'avis lui est dû. */
export function notifyElsewhereDevice(userId: string, deviceKey: string): void {
  const elsewhere = elsewhereFor(userId, deviceKey);
  if (elsewhere) sendToDevices([deviceKey], { type: "wt:elsewhere", elsewhere });
}
