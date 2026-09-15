import type { Invite, Room } from "./roomTypes";

/**
 * Watch Together — le registre en mémoire (éphémère, aucune persistance) :
 * les salles, l'index membre → salle, les invitations. Rien que des maps et
 * des lectures ; les mutations vivent dans `roomStore.ts` et `roomInvites.ts`.
 *
 * Invariant central : un utilisateur appartient à AU PLUS un groupe
 * (`memberIndex`), et n'a qu'une invitation pendante par groupe.
 */

export const rooms = new Map<string, Room>();
/** userId → groupId (un seul groupe par utilisateur). */
export const memberIndex = new Map<string, string>();
export const invites = new Map<string, Invite>();

export function getRoom(groupId: string): Room | null {
  return rooms.get(groupId) ?? null;
}

/** Itérateur des rooms actives (sweeps périodiques du gateway). */
export function allRooms(): IterableIterator<Room> {
  return rooms.values();
}

export function getRoomOf(userId: string): Room | null {
  const groupId = memberIndex.get(userId);
  return groupId ? (rooms.get(groupId) ?? null) : null;
}
