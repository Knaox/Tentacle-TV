import { isUserOnline } from "../wsManager";
import { WT_BARRIER_TIMEOUT_MS, WT_PROTOCOL_VERSION, type WtWaitCause } from "./protocol";
import type { Room, RoomMember } from "./roomTypes";
import { scheduleResume } from "./syncSchedule";

/**
 * Watch Together — la barrière « tous posés » avant de repartir.
 *
 * Un seek appliqué « à la réception » atterrit chez chacun à un instant
 * différent (distance à l'image clé, segment HLS à aller chercher), et la
 * boucle de dérive met des secondes à recoller. Ici la salle se met en
 * attente sur la cible : chaque lecteur v2 se cale, en pause, et confirme
 * (`wt:buffering false` avec l'identifiant de la barrière) ; le dernier
 * déclenche une reprise planifiée — tous repartent de la même image, au
 * même instant. Un client d'avant n'est jamais attendu : il ne saurait pas
 * répondre, et se recale comme il l'a toujours fait.
 *
 * Une barrière remplace la précédente (nouvel identifiant : les « prêts »
 * de l'ancienne sont périmés), et lâche ses retardataires au bout de
 * WT_BARRIER_TIMEOUT_MS sans les déclarer en échec.
 */

let expiryHandler: ((room: Room) => void) | null = null;

/** Le gateway s'inscrit ici : c'est lui qui sait diffuser. */
export function onBarrierExpired(handler: (room: Room) => void): void {
  expiryHandler = handler;
}

function armTimer(room: Room, barrier: { timer: ReturnType<typeof setTimeout> | null }): void {
  barrier.timer = setTimeout(() => {
    barrier.timer = null;
    if (room.barrier?.timer !== null || room.barrier === null) return; // remplacée entre-temps
    expireBarrier(room, Date.now());
    expiryHandler?.(room);
  }, WT_BARRIER_TIMEOUT_MS);
}

function clearBarrier(room: Room): void {
  if (room.barrier?.timer) clearTimeout(room.barrier.timer);
  room.barrier = null;
  room.waitCause = null;
  room.waitingFor.clear();
  room.waitingSince.clear();
}

/** Les membres qu'une barrière de seek/saut attend : en lecture, en ligne, v2. */
export function barrierParticipants(room: Room): string[] {
  const ids: string[] = [];
  for (const m of room.members.values()) {
    if (m.inPlayback && m.protocolVersion >= WT_PROTOCOL_VERSION && isUserOnline(m.userId)) ids.push(m.userId);
  }
  return ids;
}

/**
 * Ouvre (ou remplace) une barrière sur `targetTicks`. `waitFor` : les membres
 * attendus ; vide, la barrière se libère sur-le-champ (salle de clients
 * d'avant : le seek s'applique comme avant, la reprise est planifiée).
 * `timed` : lâcher les retardataires au bout du délai (jamais pour un
 * chargement, qui garde le sweep anti-gel).
 */
export function openBarrier(
  room: Room,
  now: number,
  cause: WtWaitCause,
  targetTicks: number,
  waitFor: readonly string[],
  resumeOnRelease: boolean,
  timed: boolean,
): { released: boolean; resumed: boolean } {
  clearBarrier(room);
  room.barrierId += 1;
  room.positionTicks = targetTicks;
  room.stateAtServerTime = now;
  room.paused = true;
  room.pauseReason = resumeOnRelease ? "buffering" : "user";
  room.waitCause = cause;
  for (const userId of waitFor) {
    room.waitingFor.add(userId);
    room.waitingSince.set(userId, now);
  }
  room.barrier = { id: room.barrierId, targetTicks, cause, openedAt: now, resumeOnRelease, timer: null };
  if (timed) armTimer(room, room.barrier);
  room.epoch += 1;
  if (room.waitingFor.size === 0) return releaseBarrier(room, now);
  return { released: false, resumed: false };
}

/** Un membre rejoint la barrière en cours (il charge, il bufferise). */
export function joinBarrier(room: Room, userId: string, now: number): void {
  room.waitingFor.add(userId);
  room.waitingSince.set(userId, now);
}

/** Libère la barrière : reprise planifiée si la salle jouait, sinon pause. */
function releaseBarrier(room: Room, now: number): { released: boolean; resumed: boolean } {
  const resume = room.barrier?.resumeOnRelease ?? room.pauseReason === "buffering";
  clearBarrier(room);
  if (resume) {
    scheduleResume(room, now, room.positionTicks);
    return { released: true, resumed: true };
  }
  room.pauseReason = "user";
  room.epoch += 1;
  return { released: true, resumed: false };
}

/**
 * Un membre est posé (ou ne compte plus). `barrierId` : l'écho de l'état sur
 * lequel il s'est posé — périmé, il ne libère rien ; absent (client d'avant,
 * départ), il vaut pour la barrière courante. Renvoie ce qu'il en advient.
 */
export function confirmReady(
  room: Room,
  member: Pick<RoomMember, "userId">,
  now: number,
  barrierId?: number,
): { released: boolean; resumed: boolean; stale: boolean } {
  if (barrierId !== undefined && room.barrier && barrierId !== room.barrier.id) {
    return { released: false, resumed: false, stale: true };
  }
  room.waitingFor.delete(member.userId);
  room.waitingSince.delete(member.userId);
  if (room.waitingFor.size > 0) return { released: false, resumed: false, stale: false };
  if (!room.barrier && !(room.paused && room.pauseReason === "buffering")) {
    return { released: false, resumed: false, stale: false };
  }
  return { ...releaseBarrier(room, now), stale: false };
}

/** La reprise est demandée pendant une attente : elle aura lieu à la libération. */
export function requestResumeOnRelease(room: Room): void {
  if (!room.barrier) return;
  room.barrier.resumeOnRelease = true;
  room.pauseReason = "buffering";
  room.waitCause = "play";
  room.epoch += 1;
}

/** L'utilisateur met en pause pendant une attente : plus de reprise à la libération. */
export function cancelResumeOnRelease(room: Room): void {
  if (!room.barrier) return;
  room.barrier.resumeOnRelease = false;
  room.pauseReason = "user";
}

/** Délai écoulé : les retardataires sont lâchés, sans échec, et la salle repart. */
export function expireBarrier(room: Room, now: number): { released: boolean; resumed: boolean } {
  if (!room.barrier) return { released: false, resumed: false };
  for (const userId of room.waitingFor) {
    const member = room.members.get(userId);
    if (member) member.buffering = false;
  }
  room.waitingFor.clear();
  room.waitingSince.clear();
  return releaseBarrier(room, now);
}

/** Purge sans reprise ni remplacement (changement de média, dissolution). */
export function dropBarrier(room: Room): void {
  clearBarrier(room);
}
