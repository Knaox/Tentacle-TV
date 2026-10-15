/**
 * Watch Together face aux droits des comptes (docs/DROITS-UTILISATEURS.md § 5).
 *
 * Un salon diffuse son titre (`itemId`) à TOUS ses membres : un membre dont la
 * politique Jellyfin interdit ce titre n'a rien à en recevoir — ni l'id, ni le
 * nom, ni l'affiche (Jellyfin sert les images sans jeton). D'où trois portes :
 *
 * - **l'invitation** : nom du titre lu au nom de la CIBLE ; une cible qui ne
 *   voit pas le titre EN LECTURE n'est pas invitée ;
 * - **l'entrée** (accepter) : refusée si le titre en lecture lui est caché ;
 * - **le changement de titre** (`wt:setItem`) : refusé (`stale_item`) dès
 *   qu'un membre ne voit pas le nouveau titre.
 *
 * Ce dernier est asynchrone (Jellyfin tranche) alors que le protocole suppose
 * l'ordre d'arrivée (le lanceur envoie `wt:buffering` juste après son
 * `wt:setItem`) : tant qu'une vérification court, les messages suivants du
 * salon attendent derrière elle, dans l'ordre (`inRoomOrder`). Sans
 * vérification en cours, tout reste synchrone, comme avant.
 */

import { isItemVisibleTo } from "../itemAccess/itemVisibility";
import type { Room } from "./roomTypes";

/** Les membres du salon qui ne voient PAS ce titre (Jellyfin muet : aucun ne le voit). */
export async function membersBlindTo(room: Room, itemId: string): Promise<string[]> {
  const members = [...room.members.keys()];
  const verdicts = await Promise.all(members.map((userId) => isItemVisibleTo(userId, itemId)));
  return members.filter((_userId, index) => !verdicts[index]);
}

/** Le titre en lecture du salon est-il visible à ce compte ? Salon sans titre : oui. */
export async function seesRoomItem(room: Room, userId: string): Promise<boolean> {
  return room.itemId ? isItemVisibleTo(userId, room.itemId) : true;
}

interface Queue {
  tail: Promise<void>;
  pending: number;
}

const queues = new WeakMap<Room, Queue>();

/**
 * Exécute `task` dans l'ordre d'arrivée des messages du salon : tout de suite
 * si rien n'attend, sinon derrière ce qui attend. `async` : la tâche ouvre une
 * attente que les messages suivants respecteront.
 */
export function inRoomOrder(room: Room, task: () => void | Promise<void>, async = false): void {
  const queue = queues.get(room);
  if (!queue && !async) {
    task();
    return;
  }
  const current = queue ?? { tail: Promise.resolve(), pending: 0 };
  queues.set(room, current);
  current.pending += 1;
  current.tail = current.tail
    .then(task)
    .catch(() => {})
    .finally(() => {
      current.pending -= 1;
      if (current.pending === 0 && queues.get(room) === current) queues.delete(room);
    });
}
