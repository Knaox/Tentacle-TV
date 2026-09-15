import { isUserOnline } from "../wsManager";
import {
  TICKS_PER_MS, WT_DEFAULT_RTT_MS, WT_SCHEDULE_MARGIN_MS, WT_SCHEDULE_MAX_MS, WT_SCHEDULE_MIN_MS,
  wtPositionTicksAt,
} from "./protocol";
import type { Room, RoomMember } from "./roomTypes";

/**
 * Watch Together — l'horloge de la salle : re-base de l'état, reprise
 * planifiée, délai de reprise.
 *
 * Une reprise « à la réception » repart chez chacun quand SON message
 * arrive : l'écart entre deux membres vaut leur différence de latence, plus
 * le temps de démarrage de chaque lecteur. Une reprise PLANIFIÉE pose
 * `stateAtServerTime` dans le futur (`now + lead`) avec `paused = false` :
 * `wtPositionTicksAt` n'avance pas avant cet instant, chaque lecteur v2 se
 * cale sur la position gelée puis lance la lecture à T, et un client d'avant
 * repart à la réception — au plus `lead` devant, ce que sa boucle rattrape.
 */

/** Une reprise planifiée est en attente : la salle joue, mais pas encore. */
export function hasFutureAnchor(room: Room, now: number): boolean {
  return !room.paused && room.stateAtServerTime > now;
}

/**
 * Re-base l'état de lecture à `now` (+1 epoch). Sans position explicite, la
 * position est ré-extrapolée depuis l'état de pause ACTUEL de la room — tout
 * handler qui bascule `paused` doit donc fournir la position calculée AVANT
 * le flip, sinon le temps de pause/lecture serait compté à tort.
 *
 * GARDE : une mutation sans position (présence, entrée, statut) pendant la
 * fenêtre d'une reprise planifiée ne touche qu'à l'epoch. Re-baser à `now`
 * ramènerait l'ancre dans le passé et chaque lecteur repartirait quand il
 * reçoit — exactement le décalage que la planification supprime.
 */
export function touch(room: Room, now: number, positionTicks?: number): void {
  if (positionTicks === undefined && hasFutureAnchor(room, now)) {
    room.epoch += 1;
    return;
  }
  room.positionTicks = positionTicks !== undefined ? positionTicks : wtPositionTicksAt(room, now);
  room.stateAtServerTime = now;
  room.epoch += 1;
}

/** Mutation de composition/statut sans effet sur la lecture (join, statut
 *  membre) : re-base neutre + epoch, pour que le broadcast ne soit pas ignoré
 *  comme stale par les clients. */
export function bumpEpoch(room: Room): void {
  touch(room, Date.now());
}

/** Aller-retour retenu pour un membre : le sien s'il l'a dit, sinon le défaut. */
export function memberRtt(member: RoomMember): number {
  return member.rttMs ?? WT_DEFAULT_RTT_MS;
}

/**
 * Délai avant une reprise planifiée : le membre EN LECTURE le plus lent, plus
 * une marge — borné (voir protocol.ts). Un membre hors ligne ou hors lecture
 * ne repart pas : il ne compte pas.
 */
export function computeLead(room: Room): number {
  let slowest = 0;
  for (const m of room.members.values()) {
    if (!m.inPlayback || !isUserOnline(m.userId)) continue;
    slowest = Math.max(slowest, memberRtt(m));
  }
  if (slowest === 0) slowest = WT_DEFAULT_RTT_MS;
  return Math.min(WT_SCHEDULE_MAX_MS, Math.max(WT_SCHEDULE_MIN_MS, slowest + WT_SCHEDULE_MARGIN_MS));
}

/**
 * Programme la reprise : lecture depuis `frozenTicks` à l'instant `now + lead`.
 * L'attente est levée, la cause d'attente effacée. Renvoie le délai retenu.
 */
export function scheduleResume(room: Room, now: number, frozenTicks: number): number {
  const lead = computeLead(room);
  room.paused = false;
  room.pauseReason = null;
  room.waitCause = null;
  room.positionTicks = frozenTicks;
  room.stateAtServerTime = now + lead;
  room.epoch += 1;
  return lead;
}

/**
 * Position d'ancrage d'une reprise demandée par un membre qui joue DÉJÀ (client
 * d'avant : il a lancé sa lecture avant d'envoyer `wt:play`). À l'instant de
 * reprise, il sera à `reçu + rtt/2 + lead` : c'est là que les autres doivent
 * repartir pour être avec lui, plutôt que de le laisser devant.
 */
export function anchorOnPlayingSender(positionTicks: number, member: RoomMember, lead: number): number {
  return positionTicks + Math.round(memberRtt(member) / 2 + lead) * TICKS_PER_MS;
}
