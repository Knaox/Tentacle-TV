import type { WebSocket } from "@fastify/websocket";
import { isDeviceOnline, isUserOnline, sendToDevices, sendToUser, type WsServerMessage } from "../wsManager";
import { WT_GRACE_PERIOD_MS } from "./protocol";
import type { Room, RoomMember } from "./roomTypes";

/**
 * Watch Together — l'adhésion PAR APPAREIL (1.32.0, `watchTogether.deviceMembership`).
 *
 * Un appareil, c'est le hash du jeton qui ouvre sa socket et ses appels REST
 * (le cookie du web, l'`Authorization` du bureau et du mobile) : le serveur le
 * connaît déjà, aucun client n'a rien à annoncer — un client d'avant en
 * profite comme les autres. Un membre (un compte) a 1..n appareils LIÉS : ceux
 * qui ont créé la salle, accepté l'invitation, ou choisi « Rejoindre ici ».
 * Eux seuls reçoivent la séance et y parlent ; les autres appareils du compte
 * n'en reçoivent que l'avis `wt:elsewhere` (cf. `elsewhere.ts`).
 *
 * Un membre SANS appareil lié (appel interne, bancs d'avant) garde le
 * comportement d'avant : tout son compte, toutes ses sockets.
 */

/** Un appareil lié à la salle, et sa grâce de déconnexion. */
export interface MemberDevice {
  key: string;
  boundAt: number;
  graceTimer: ReturnType<typeof setTimeout> | null;
}

export function bindDevice(member: RoomMember, deviceKey: string, now: number = Date.now()): boolean {
  if (member.devices.has(deviceKey)) return false;
  member.devices.set(deviceKey, { key: deviceKey, boundAt: now, graceTimer: null });
  return true;
}

/** Délie un appareil ; rend le nombre d'appareils qui restent liés. */
export function unbindDevice(member: RoomMember, deviceKey: string): number {
  const device = member.devices.get(deviceKey);
  if (device?.graceTimer) clearTimeout(device.graceTimer);
  member.devices.delete(deviceKey);
  return member.devices.size;
}

/** Cet appareil parle-t-il pour ce membre dans la salle ? Un membre sans
 *  appareil lié (comportement d'avant) : tous ses appareils. */
export function isDeviceBound(member: RoomMember, deviceKey: string | undefined): boolean {
  if (member.devices.size === 0) return true;
  return deviceKey !== undefined && member.devices.has(deviceKey);
}

/** En ligne = au moins un appareil lié a une socket ouverte. */
export function isMemberOnline(member: RoomMember): boolean {
  if (member.devices.size === 0) return isUserOnline(member.userId);
  for (const key of member.devices.keys()) if (isDeviceOnline(key)) return true;
  return false;
}

/** Le prédicat « en ligne » d'une salle, par identifiant de membre. */
export function roomOnline(room: Room): (userId: string) => boolean {
  return (userId) => {
    const member = room.members.get(userId);
    return !!member && isMemberOnline(member);
  };
}

/** Un message de la séance à un membre : à ses SEULS appareils liés. */
export function sendToMember(
  member: RoomMember,
  msg: WsServerMessage,
  opts?: { exceptSocket?: WebSocket },
): void {
  if (member.devices.size === 0) sendToUser(member.userId, msg, opts);
  else sendToDevices(member.devices.keys(), msg, opts);
}

/** À tous les membres de la salle (à leurs appareils liés). */
export function sendToRoom(room: Room, msg: WsServerMessage, opts?: { exceptSocket?: WebSocket }): void {
  for (const member of room.members.values()) sendToMember(member, msg, opts);
}

// ── Grâce par appareil ──

/** Un appareil lié passe hors ligne : s'il ne revient pas, `onExpired` le
 *  délie. `graceMs` court (départ annoncé, `wt:goodbye`) remplace un long. */
export function armDeviceGrace(
  member: RoomMember,
  deviceKey: string,
  onExpired: (deviceKey: string) => void,
  graceMs: number = WT_GRACE_PERIOD_MS,
): void {
  const device = member.devices.get(deviceKey);
  if (!device) return;
  if (device.graceTimer) {
    if (graceMs >= WT_GRACE_PERIOD_MS) return; // un délai court prime
    clearTimeout(device.graceTimer);
  }
  device.graceTimer = setTimeout(() => {
    device.graceTimer = null;
    onExpired(deviceKey);
  }, graceMs);
}

export function cancelDeviceGrace(member: RoomMember, deviceKey: string): void {
  const device = member.devices.get(deviceKey);
  if (device?.graceTimer) {
    clearTimeout(device.graceTimer);
    device.graceTimer = null;
  }
}

/** Plus aucune minuterie d'appareil (départ du membre). */
export function clearDeviceGraces(member: RoomMember): void {
  for (const device of member.devices.values()) {
    if (device.graceTimer) clearTimeout(device.graceTimer);
    device.graceTimer = null;
  }
}
