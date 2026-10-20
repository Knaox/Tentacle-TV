import { deviceKeyOfSocket } from "../wsManager";
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
 * Vrai si c'était le cas ; faux s'il faut faire quitter le compte (dernier
 * appareil, membre sans appareil lié, appareil inconnu).
 */
export function leaveFromDevice(room: Room, member: RoomMember, deviceKey: string | undefined): boolean {
  if (deviceKey === undefined || !member.devices.has(deviceKey) || member.devices.size <= 1) return false;
  unbindDevice(member, deviceKey);
  // Son lecteur était celui de la séance : la salle ne l'attend plus.
  const resumed = member.playbackSocket !== null && deviceKeyOfSocket(member.playbackSocket) === deviceKey
    ? releaseMemberWait(room, member)
    : false;
  if (!resumed) bumpEpoch(room);
  broadcastRoom(room, resumed ? "schedule" : "presence", null);
  notifyElsewhere(member.userId);
  return true;
}
