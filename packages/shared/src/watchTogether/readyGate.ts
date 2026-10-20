import { wtPositionSecondsAt, type WtRoomStateDto } from "../types/watchTogether";

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
 * Le serveur 1.31.1 le dit (`allReady`, capacité `watchTogether.readyGate`) :
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

/**
 * La salle est-elle « tous prêts » ? Le serveur fait foi quand il le dit — mais
 * quelqu'un qui ARRIVE (du clic « Rejoindre » à son premier « prêt »,
 * `arrivingUserIds`) n'est jamais prêt : ajout de Damien du 20/10, « une intro,
 * un générique ne doivent jamais être passés tant que les membres du groupe ne
 * sont pas dedans » — ni bouton, ni décompte, ni saut, ni enchaînement.
 */
export function wtRoomAllReady(room: WtRoomStateDto): boolean {
  if ((room.arrivingUserIds?.length ?? 0) > 0) return false;
  return room.allReady ?? wtRoomAllReadyLocally(room);
}

/** Au-delà, la position du lecteur n'est pas celle de la salle (il arrive, il
 *  recharge, il saute) : un passage jugé d'après elle serait faux. */
export const WT_SKIP_ALIGN_TOLERANCE_S = 2;

/**
 * Le lecteur est-il là où est la salle ? Sinon, ses passages se taisent : un
 * arrivant ouvert à 0 s montrait « Passer l'intro » une demi-seconde avant de
 * se poser à 272 s, et le proposait à la salle (banc du 20/10).
 */
export function wtPlayerAligned(
  room: Pick<WtRoomStateDto, "paused" | "positionTicks" | "stateAtServerTime">,
  serverNow: number,
  playerS: number,
): boolean {
  return Math.abs(playerS - wtPositionSecondsAt(room, serverNow)) <= WT_SKIP_ALIGN_TOLERANCE_S;
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
