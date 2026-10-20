import { WT_ARRIVAL_TIMEOUT_MS, wtPositionTicksAt } from "./protocol";
import type { Arrival, Room, RoomMember } from "./roomTypes";
import { confirmReady, joinBarrier, openBarrier } from "./syncBarrier";
import { touch } from "./syncSchedule";
import { dropArrival, isArrivingDevice } from "./arrivalState";

/**
 * Watch Together — l'ARRIVÉE d'un appareil sur le titre de la salle (20/10 soir).
 *
 * Le défaut (retour de Damien, iPhone + téléphone Android) : l'Android clique
 * « Rejoindre », l'iPhone continue de regarder pendant tout le chargement de
 * l'Android, puis se met en pause ET recule. La salle n'attendait l'arrivant
 * qu'une fois SON lecteur monté, et se gelait parfois à la position d'un
 * lecteur qui n'avait encore rien lu. Désormais :
 *  - AU CLIC (invitation acceptée, « Rejoindre ici » : `beginArrival`), la
 *    salle se gèle à sa position courante et attend cet appareil ; l'état le
 *    dit (`arrivingUserIds`) et le nouveau s'ouvre à la position de la pause ;
 *  - un lecteur qui s'ouvre sur le titre quand son membre ne le regardait pas
 *    (« Rejoindre » de l'accueil, reconnexion) arrive aussi
 *    (`noteArrivalOnPresence`), sans gel tant qu'il ne dit pas « je charge » ;
 *  - tant qu'il n'a rien lu, la position d'un arrivant ne déplace pas la salle
 *    (`arrivingFreezeTicks`) ;
 *  - l'arrivée est PAR APPAREIL : un autre appareil du même compte ne la lève
 *    pas en parlant pour lui-même (`arrivalHeldElsewhere`) ;
 *  - elle finit au premier « prêt » de l'appareil qui arrive
 *    (`finishArrival`), ou elle est abandonnée — retour arrière, appareil hors
 *    ligne, échec, ou WT_ARRIVAL_TIMEOUT_MS sans lecteur ouvert
 *    (`abandonArrival`) : la salle repart sans lui, les clients le disent.
 */

let expiryHandler: ((room: Room) => void) | null = null;

/** Le gateway s'inscrit ici : une arrivée abandonnée par sa borne, c'est lui qui diffuse. */
export function onArrivalExpired(handler: (room: Room) => void): void {
  expiryHandler = handler;
}

function startArrival(room: Room, userId: string, deviceKey: string | null, now: number, explicit: boolean): void {
  dropArrival(room, userId);
  const arrival: Arrival = { userId, deviceKey, since: now, explicit, declared: !explicit, timer: null };
  if (explicit) {
    arrival.timer = setTimeout(() => {
      arrival.timer = null;
      if (room.arrivals.get(userId) !== arrival || arrival.declared) return;
      abandonArrival(room, userId, Date.now());
      expiryHandler?.(room);
    }, WT_ARRIVAL_TIMEOUT_MS);
  }
  room.arrivals.set(userId, arrival);
}

/**
 * Le clic « Rejoindre » d'un appareil sur une salle qui a un titre : elle se
 * gèle AUSSITÔT à sa position courante et attend cet appareil — reprise à son
 * « prêt » si elle jouait, pause gardée sinon. Faux sans titre (rien à
 * attendre). L'appelant diffuse.
 */
export function beginArrival(room: Room, member: RoomMember, deviceKey: string | null, now: number): boolean {
  if (!room.itemId) return false;
  startArrival(room, member.userId, deviceKey, now, true);
  if (room.barrier) {
    joinBarrier(room, member.userId, now);
  } else {
    const resume = !room.paused;
    if (resume) room.seekToken = null;
    openBarrier(room, now, "buffering", wtPositionTicksAt(room, now), [member.userId], resume, false);
  }
  return true;
}

/**
 * Un lecteur s'ouvre sur le titre (`wt:presence inPlayback`, déjà appliqué).
 * Celui d'un clic : l'arrivée est déclarée, sa borne s'arrête — le chargement
 * garde le délai du balayage anti-gel, compté d'ici. Sinon, un membre qui ne
 * regardait pas le titre commence une arrivée. `starting` : il est attendu au
 * lancement du titre (porte « tous prêts ») — il démarre avec les autres, il
 * n'arrive pas.
 */
export function noteArrivalOnPresence(
  room: Room,
  member: RoomMember,
  deviceKey: string | undefined,
  wasWatching: boolean,
  starting: boolean,
  now: number,
): void {
  const arrival = room.arrivals.get(member.userId);
  if (arrival) {
    // L'appareil qui regardait déjà se redéclare : l'arrivant reste à venir.
    if (!isArrivingDevice(room, member.userId, deviceKey)) return;
    if (arrival.timer) clearTimeout(arrival.timer);
    arrival.timer = null;
    arrival.declared = true;
    if (room.waitingFor.has(member.userId)) room.waitingSince.set(member.userId, now);
    return;
  }
  if (wasWatching || starting) return;
  startArrival(room, member.userId, deviceKey ?? null, now, false);
}

/**
 * La position où geler la salle quand un lecteur dit « je charge » : celle
 * qu'il rapporte (il calait en pleine lecture), SAUF s'il arrive — son lecteur
 * n'a encore rien lu (0, ou sa position de départ figée avant la pause) : la
 * salle se gèle alors sur la sienne. Le recul de l'hôte venait de là.
 */
export function arrivingFreezeTicks(
  room: Room,
  userId: string,
  deviceKey: string | undefined,
  reported: number | undefined,
  now: number,
): number {
  if (reported === undefined || isArrivingDevice(room, userId, deviceKey)) return wtPositionTicksAt(room, now);
  return reported;
}

/** Le premier « prêt » de l'appareil qui arrive : il est arrivé. */
export function finishArrival(room: Room, userId: string, deviceKey: string | undefined): void {
  if (isArrivingDevice(room, userId, deviceKey)) dropArrival(room, userId);
}

/**
 * L'arrivant renonce — appareil hors ligne, borne écoulée : l'arrivée
 * s'efface et la salle ne l'attend plus (reprise planifiée s'il était le
 * dernier attendu d'une salle qui jouait). L'appelant diffuse.
 */
export function abandonArrival(room: Room, userId: string, now: number): { abandoned: boolean; resumed: boolean } {
  if (!dropArrival(room, userId)) return { abandoned: false, resumed: false };
  const resumed = room.waitingFor.has(userId) && confirmReady(room, { userId }, now).resumed;
  if (!resumed) touch(room, now);
  return { abandoned: true, resumed };
}
