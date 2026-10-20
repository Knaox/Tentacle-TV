import { isDeviceOnline, onDevicePresenceChange, onPresenceChange, sendToUser } from "../wsManager";
import { armGrace, cancelGrace } from "./roomStore";
import { getRoomOf } from "./roomRegistry";
import { invitesFor } from "./roomInvites";
import { bumpEpoch, removeMemberAndSync } from "./sync";
import { leaveFromDevice } from "./deviceLeave";
import { broadcastRoom, inviteToDto } from "./broadcast";
import { refreshHostSettings } from "./hostSettings";
import { wtAccessOf } from "./accountAccess";
import { wtMayJoin } from "./watchTogetherAccess";
import { armDeviceGrace, cancelDeviceGrace } from "./memberDevices";
import { notifyElsewhere, notifyElsewhereDevice } from "./elsewhere";
import { wtSrvLog } from "./wtServerLog";

/**
 * Watch Together — la présence : grâce de déconnexion (un F5 ne fait pas
 * quitter), délivrance différée des invitations, et — depuis 1.31.1 —
 * l'adhésion PAR APPAREIL : la grâce court par appareil lié ; le dernier
 * appareil parti, le compte quitte la salle. Sorti de `gateway.ts`.
 */

/** Leave implicite quand la grâce (du compte, ou de son dernier appareil) expire. */
export function onGraceExpired(userId: string): void {
  const result = removeMemberAndSync(userId);
  if (!result) return;
  wtSrvLog(`grâce expirée → leave implicite de ${userId}`, {
    dissolved: result.dissolved, resumed: result.resumed,
  });
  notifyElsewhere(userId);
  if (!result.dissolved) {
    broadcastRoom(result.room, "leave", userId);
    // Nouvel hôte : ses réglages gouvernent désormais. La lecture en base est
    // asynchrone, le départ est diffusé tout de suite — les réglages suivent
    // dans un état à part, avec son propre epoch.
    if (result.newHostId) {
      const room = result.room;
      void refreshHostSettings(room).then(() => {
        bumpEpoch(room);
        broadcastRoom(room, "sync", null);
      });
    }
  }
}

/** Un appareil lié n'est pas revenu : il est délié ; le dernier emporte le compte. */
export function onDeviceGraceExpired(userId: string, deviceKey: string): void {
  const room = getRoomOf(userId);
  const member = room?.members.get(userId);
  if (!room || !member || !member.devices.has(deviceKey)) return;
  // Revenu entre-temps (un autre onglet du même navigateur, une reconnexion).
  if (isDeviceOnline(deviceKey)) return;
  if (!leaveFromDevice(room, member, deviceKey)) {
    onGraceExpired(userId);
    return;
  }
  wtSrvLog(`appareil délié (grâce expirée) : ${userId}`, { devices: member.devices.size });
}

/** Départ annoncé (`wt:goodbye`) : grâce courte — sur l'appareil s'il est lié. */
export function armGoodbye(userId: string, deviceKey: string | undefined): void {
  const member = getRoomOf(userId)?.members.get(userId);
  if (!member) return;
  if (member.devices.size === 0) {
    armGrace(userId, onGraceExpired, 10_000); // membre d'avant : tout le compte
  } else if (deviceKey !== undefined && member.devices.has(deviceKey)) {
    armDeviceGrace(member, deviceKey, (key) => onDeviceGraceExpired(userId, key), 10_000);
  }
  // Un appareil non lié qui se ferme ne fait rien quitter.
}

/** Un appareil vient d'être lié par un appel REST : sans socket ouverte, sa
 *  grâce court tout de suite — il ne resterait sinon lié pour toujours. */
export function watchBoundDevice(userId: string, deviceKey: string | undefined): void {
  const member = getRoomOf(userId)?.members.get(userId);
  if (!member || deviceKey === undefined || !member.devices.has(deviceKey) || isDeviceOnline(deviceKey)) return;
  armDeviceGrace(member, deviceKey, (key) => onDeviceGraceExpired(userId, key));
}

/** Le compte n'est plus dans sa salle que par des appareils éteints (en
 *  grâce) : il la quitte maintenant, comme à leur expiration. Rien s'il y a un
 *  appareil lié en ligne, ou un membre sans appareil lié (comportement d'avant). */
export function releaseFromDeadRoom(userId: string): void {
  const member = getRoomOf(userId)?.members.get(userId);
  if (!member || member.devices.size === 0) return;
  for (const key of member.devices.keys()) if (isDeviceOnline(key)) return;
  wtSrvLog(`appareils liés tous éteints : ${userId} quitte sa salle pour en créer une`);
  onGraceExpired(userId);
}

/** Branche la présence (appelé une fois, par le gateway). */
export function registerPresence(): void {
  onPresenceChange((userId, online) => {
    if (online) {
      cancelGrace(userId);
      // Délivrance différée : un invité hors ligne au moment de l'invitation
      // la reçoit dès sa prochaine connexion (si le groupe vit encore).
      // Un compte passé à « Interdit » ne reçoit plus rien de Watch Together.
      const pending = invitesFor(userId);
      if (pending.length > 0) {
        void wtAccessOf(userId).then((access) => {
          if (!wtMayJoin(access)) return;
          for (const invite of pending) sendToUser(userId, { type: "wt:invite", invite: inviteToDto(invite) });
        });
      }
    }
    const room = getRoomOf(userId);
    const member = room?.members.get(userId);
    // Un membre aux appareils liés : sa présence se suit par appareil (plus bas).
    if (!room || !member || member.devices.size > 0) return;
    wtSrvLog(`présence WS : ${userId} ${online ? "ONLINE (grâce annulée)" : "OFFLINE (grâce 120s armée)"}`);
    if (!online) armGrace(userId, onGraceExpired);
    // Statut online/offline du membre visible par les autres.
    bumpEpoch(room);
    broadcastRoom(room, "presence", null);
  });

  onDevicePresenceChange((userId, deviceKey, online) => {
    const room = getRoomOf(userId);
    const member = room?.members.get(userId);
    if (!room || !member) return;
    if (!member.devices.has(deviceKey)) {
      // Un autre appareil du compte se connecte : l'avis, rien de plus.
      if (online && member.devices.size > 0) notifyElsewhereDevice(userId, deviceKey);
      return;
    }
    wtSrvLog(`présence appareil : ${userId} ${online ? "en ligne" : "hors ligne (grâce 120s)"}`);
    if (online) cancelDeviceGrace(member, deviceKey);
    else armDeviceGrace(member, deviceKey, (key) => onDeviceGraceExpired(userId, key));
    bumpEpoch(room);
    broadcastRoom(room, "presence", null);
  });
}
