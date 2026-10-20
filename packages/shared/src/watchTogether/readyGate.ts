import type { WtRoomStateDto } from "../types/watchTogether";

/**
 * Watch Together — « tous prêts » avant tout saut de passage.
 *
 * Le bug (lot du 20/10) : une vidéo qui commence par une intro montrait
 * « Passer l'intro » avant que tous les membres soient prêts ; le premier
 * posé sautait seul, les autres arrivaient après le saut. RÈGLE : en séance,
 * aucun saut de passage — intro, résumé, générique, saut automatique compris —
 * tant que la salle n'est pas « tous prêts ». Ensuite, un saut est une action
 * de SALLE : le clic est un `wt:seek` (barrière : tous se calent, tous
 * repartent ensemble), le saut automatique un décompte armé par le serveur.
 *
 * Le serveur 1.32.0 le dit (`allReady`, capacité `watchTogether.readyGate`) :
 * il sait QUI la salle attend pour le titre, y compris ceux qui ne sont pas
 * encore arrivés sur la page de lecture. Face à un serveur d'avant, le client
 * en juge d'après l'état seul (`wtRoomAllReadyLocally`) — moins fin : un
 * membre resté sur l'accueil n'y bloque rien.
 */

/** Jugement local, pour un serveur qui ne dit pas `allReady`. */
export function wtRoomAllReadyLocally(room: WtRoomStateDto): boolean {
  if (!room.itemId || room.barrierId !== undefined || room.waitingForUserIds.length > 0) return false;
  return room.members.every((m) => !m.online || m.playbackError || (m.inPlayback && !m.buffering));
}

/** La salle est-elle « tous prêts » ? Le serveur fait foi quand il le dit. */
export function wtRoomAllReady(room: WtRoomStateDto): boolean {
  return room.allReady ?? wtRoomAllReadyLocally(room);
}

/**
 * Les sauts de passage de CE lecteur sont-ils retenus ? Seulement en séance,
 * sur le titre de la salle, tant qu'elle n'est pas « tous prêts ». Hors
 * séance — ou sur un autre titre — rien n'est retenu.
 */
export function wtSkipHeld(room: WtRoomStateDto | null | undefined, itemId: string | undefined): boolean {
  if (!room || !itemId || room.itemId !== itemId) return false;
  return !wtRoomAllReady(room);
}
