import type { Arrival, Room } from "./roomTypes";

/**
 * Watch Together — les arrivées en cours d'une salle, en lectures et en
 * retraits simples (sans barrière ni diffusion : `arrival.ts`). À part pour que
 * `roomStore.ts` efface l'arrivée d'un membre qui part sans dépendre de la
 * synchronisation.
 */

/** L'arrivée en cours d'un membre, s'il en a une. */
export function arrivalOf(room: Room, userId: string): Arrival | null {
  return room.arrivals.get(userId) ?? null;
}

/** Cet appareil est-il celui qui arrive pour ce membre ? Une arrivée sans
 *  appareil (membre d'avant l'adhésion par appareil) vaut pour tout le compte. */
export function isArrivingDevice(room: Room, userId: string, deviceKey: string | undefined): boolean {
  const arrival = room.arrivals.get(userId);
  return !!arrival && (arrival.deviceKey === null || arrival.deviceKey === deviceKey);
}

/**
 * Un AUTRE appareil du compte que celui qui arrive (« Rejoindre ici » : le
 * premier PC regarde, le second arrive). Ce qu'il dit pour lui-même — « prêt »,
 * départ du lecteur, échec — ne lève pas l'attente de l'arrivant : l'état de
 * lecture du serveur est par compte, il la lèverait à tort.
 */
export function arrivalHeldElsewhere(room: Room, userId: string, deviceKey: string | undefined): boolean {
  const arrival = room.arrivals.get(userId);
  return !!arrival && arrival.deviceKey !== null && arrival.deviceKey !== deviceKey;
}

/** Retire l'arrivée d'un membre (sa borne avec). Vrai s'il en avait une. */
export function dropArrival(room: Room, userId: string): boolean {
  const arrival = room.arrivals.get(userId);
  if (!arrival) return false;
  if (arrival.timer) clearTimeout(arrival.timer);
  arrival.timer = null;
  room.arrivals.delete(userId);
  return true;
}

/**
 * Les arrivants que l'état DIT (`arrivingUserIds`) : ceux d'un clic, et ceux
 * dont le lecteur fait attendre la salle. Un lecteur qui se rouvre déjà prêt
 * (reconnexion) n'arrête personne : il ne s'annonce pas.
 */
export function visibleArrivals(room: Room): string[] {
  const ids: string[] = [];
  for (const arrival of room.arrivals.values()) {
    if (arrival.explicit || room.waitingFor.has(arrival.userId)) ids.push(arrival.userId);
  }
  return ids;
}
