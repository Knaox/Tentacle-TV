import { TICKS_PER_MS, WT_TICK_BROADCAST_MS, wtPositionTicksAt } from "./protocol";
import type { Room, RoomMember } from "./roomTypes";

/**
 * Watch Together — les balises des lecteurs (`wt:tick`), toutes les 5 s :
 * position, horloge, aller-retour. Rien n'en commande la salle ; on en tire
 * l'ÉCART de chaque membre à la position de la salle — le diagnostic qui
 * rend la synchro visible (badge du panneau, journaux) — et son aller-retour,
 * pour le délai des reprises planifiées.
 *
 * L'écart se calcule à l'instant où le lecteur a lu sa position (son
 * `atServerTime`), pas à la réception : sinon la moitié de l'aller-retour
 * passerait pour du retard.
 */

/** Enregistre une balise. Vrai si une diffusion des écarts est due. */
export function recordTick(
  room: Room,
  member: RoomMember,
  msg: { positionTicks: number; paused: boolean; atServerTime: number; rttMs?: number },
  now: number,
): boolean {
  if (msg.rttMs !== undefined) member.rttMs = msg.rttMs;
  // Un lecteur en pause pendant que la salle joue (ou l'inverse) n'a pas
  // d'écart : il est ailleurs, pas décalé.
  member.driftMs = msg.paused === room.paused
    ? Math.round((msg.positionTicks - wtPositionTicksAt(room, msg.atServerTime)) / TICKS_PER_MS)
    : null;
  if (now - room.lastTickBroadcastAt < WT_TICK_BROADCAST_MS) return false;
  room.lastTickBroadcastAt = now;
  return true;
}
