import { allRooms, getRoomOf } from "./roomRegistry";
import { broadcastRoom, notifyDissolved } from "./broadcast";
import { refreshHostSettings } from "./hostSettings";
import { removeMemberAndSync } from "./sync";
import { forgetAccessOnPolicyWrites, revokedMembers } from "./accountAccess";
import { getJellyfinUsers } from "./usersCache";
import type { WtDissolvedReason } from "./protocol";

/**
 * Un membre dont le compte perd Watch Together (`SyncPlayAccess` passé à
 * « Interdit ») sort de son salon, proprement : il reçoit `wt:dissolved`
 * (raison `access_revoked`), les autres un départ, l'hôte change s'il le faut
 * (docs/DROITS-UTILISATEURS.md § 9.2). Un hôte qui ne fait que perdre `full`
 * garde son salon : comme Jellyfin, le droit se juge à la création et à
 * l'entrée.
 *
 * Un changement fait par Tentacle se voit sur-le-champ
 * (`onContentPolicyInvalidated`) ; un changement fait dans Jellyfin, au plus
 * tard au guet suivant (30 s) — une lecture de `/Users` pour tous les comptes,
 * et seulement tant qu'un salon existe.
 */

const SWEEP_MS = 30_000;

/** Sort un compte de son salon, avec la raison dite à lui seul. Rien s'il n'est dans aucun. */
export async function ejectFromRoom(userId: string, reason: WtDissolvedReason): Promise<boolean> {
  const room = getRoomOf(userId);
  if (!room) return false;
  const result = removeMemberAndSync(userId);
  if (!result) return false;
  notifyDissolved(userId, room.groupId, reason);
  if (!result.dissolved) {
    // Nouvel hôte : ses réglages d'abord, puis le départ diffusé.
    if (result.newHostId) await refreshHostSettings(result.room);
    broadcastRoom(result.room, "leave", userId);
  }
  console.log(`[wt] membre sorti de son salon (${reason})`);
  return true;
}

let sweeping = false;

/** Le guet : chaque membre d'un salon dont la politique LUE dit « Interdit » en sort. */
export async function sweepRevokedMembers(): Promise<number> {
  if (sweeping) return 0;
  const memberIds = [...allRooms()].flatMap((room) => [...room.members.keys()]);
  if (memberIds.length === 0) return 0;
  sweeping = true;
  try {
    const revoked = revokedMembers(await getJellyfinUsers(), memberIds);
    let ejected = 0;
    for (const userId of revoked) if (await ejectFromRoom(userId, "access_revoked")) ejected += 1;
    return ejected;
  } finally {
    sweeping = false;
  }
}

let timer: ReturnType<typeof setInterval> | null = null;

/** Branché une fois au démarrage (gateway). */
export function registerAccessWatch(): void {
  if (timer) return;
  forgetAccessOnPolicyWrites(() => void sweepRevokedMembers());
  timer = setInterval(() => void sweepRevokedMembers(), SWEEP_MS);
  timer.unref?.();
}
