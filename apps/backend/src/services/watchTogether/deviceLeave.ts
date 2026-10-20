import { deviceKeyOfSocket, isDeviceOnline } from "../wsManager";
import type { Room, RoomMember } from "./roomTypes";
import { bumpEpoch, releaseMemberWait } from "./sync";
import { broadcastRoom } from "./broadcast";
import { unbindDevice } from "./memberDevices";
import { notifyElsewhere } from "./elsewhere";

/**
 * Watch Together — un appareil quitte la salle SANS que son compte la quitte
 * (1.32.0) : il lui reste un autre appareil lié. « Quitter » sur l'un des deux
 * PC, ou la grâce d'un appareil éteint : l'autre reste dans la séance, les
 * autres membres ne voient personne partir.
 *
 * `sweepOffline` (un « Quitter » explicite) : les appareils HORS LIGNE du
 * compte partent avec lui — un appareil éteint ne garde pas le compte dans la
 * salle les 120 s de sa grâce (constat du banc : un nouvel appareil ne pouvait
 * alors ni créer de groupe ni libérer le compte). Une grâce qui expire, elle,
 * ne touche qu'à son appareil : les autres ont la leur.
 *
 * Vrai si un appareil EN LIGNE reste ; faux s'il faut faire quitter le compte
 * (dernier appareil, membre sans appareil lié, appareil inconnu).
 */
export function leaveFromDevice(
  room: Room,
  member: RoomMember,
  deviceKey: string | undefined,
  options: { sweepOffline?: boolean } = {},
): boolean {
  if (deviceKey === undefined || !member.devices.has(deviceKey)) return false;
  const others = [...member.devices.keys()].filter((key) => key !== deviceKey);
  const leaving = [deviceKey, ...(options.sweepOffline ? others.filter((key) => !isDeviceOnline(key)) : [])];
  if (leaving.length === member.devices.size) return false;
  let resumed = false;
  for (const key of leaving) {
    unbindDevice(member, key);
    // Son lecteur était celui de la séance : la salle ne l'attend plus.
    if (member.playbackSocket !== null && deviceKeyOfSocket(member.playbackSocket) === key) {
      resumed = releaseMemberWait(room, member) || resumed;
    }
  }
  if (!resumed) bumpEpoch(room);
  broadcastRoom(room, resumed ? "schedule" : "presence", null);
  notifyElsewhere(member.userId);
  return true;
}
