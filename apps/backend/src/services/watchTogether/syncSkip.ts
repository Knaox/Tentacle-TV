import { DEFAULT_PLAYBACK_SETTINGS, type PlaybackSettings, type SegmentSettings } from "../../playback/playbackSettings";
import type { SegmentType } from "../../playback/segmentTypes";
import { TICKS_PER_MS, wtPositionTicksAt } from "./protocol";
import type { Room, RoomMember } from "./roomTypes";
import { barrierParticipants, openBarrier } from "./syncBarrier";
import { touch } from "./syncSchedule";

/**
 * Watch Together — le saut de passage armé par le serveur.
 *
 * Le décompte d'un « Passer l'intro » ne tourne plus dans l'onglet de l'hôte
 * (ralenti dès qu'il passe en arrière-plan, invisible chez les autres) : un
 * lecteur qui entre dans un passage que les réglages de l'HÔTE sautent tout
 * seuls le PROPOSE, le serveur arme UN décompte pour la salle — en position
 * de média, pas en heure murale : une pause le fige — et l'exécute par une
 * barrière de seek. Tous les lecteurs proposent, un seul gagne (dédup par
 * passage) ; un clic saute tout de suite (c'est un seek), une croix annule.
 */

/** Tant que la salle est en pause, on revérifie à cette cadence. */
const SKIP_TIMER_POLL_MS = 1_000;
const SKIP_TIMER_MIN_MS = 30;
/** Une proposition ne vaut que si la salle est bien dans le passage (ticks). */
const PROPOSAL_TOLERANCE_TICKS = 2_000 * TICKS_PER_MS;

let executedHandler: ((room: Room) => void) | null = null;

/** Le gateway s'inscrit ici : c'est lui qui sait diffuser. */
export function onSkipExecuted(handler: (room: Room) => void): void {
  executedHandler = handler;
}

/** Le réglage qui gouverne ce passage — miroir de `segmentSettingsFor`
 *  (packages/shared/src/playback/skipCandidate.ts), que le backend n'a pas. */
function settingsForSegment(settings: PlaybackSettings, type: SegmentType, isEpisode: boolean): SegmentSettings | null {
  if (type === "Intro") return settings.intro;
  if (type === "Outro") return isEpisode ? settings.outro : settings.outroFilm;
  if (type === "Recap") return settings.recap;
  if (type === "Preview") return settings.preview;
  return null;
}

function skipKey(itemId: string, type: SegmentType, startTicks: number): string {
  return `${itemId}:${type}:${startTicks}`;
}

function clearTimer(room: Room): void {
  if (room.skipTimer) { clearTimeout(room.skipTimer); room.skipTimer = null; }
}

/** Arme (ou réarme) le minuteur depuis la position de la salle ; se réarme
 *  tout seul tant qu'elle est en pause, ou qu'une reprise planifiée n'a pas
 *  encore fait courir la position. */
export function armSkipTimer(room: Room): void {
  clearTimer(room);
  const pending = room.pendingSkip;
  if (!pending) return;
  const now = Date.now();
  const remainingMs = (pending.skipAtPositionTicks - wtPositionTicksAt(room, now)) / TICKS_PER_MS
    + Math.max(0, room.stateAtServerTime - now);
  const delay = room.paused ? SKIP_TIMER_POLL_MS : Math.max(SKIP_TIMER_MIN_MS, remainingMs);
  room.skipTimer = setTimeout(() => {
    room.skipTimer = null;
    const current = room.pendingSkip;
    if (!current) return;
    const at = Date.now();
    if (room.paused || wtPositionTicksAt(room, at) < current.skipAtPositionTicks - SKIP_TIMER_MIN_MS * TICKS_PER_MS) {
      armSkipTimer(room);
      return;
    }
    executeSkip(room, at);
    executedHandler?.(room);
  }, delay);
}

/** Un lecteur propose le saut d'un passage. Vrai si la salle l'a armé. */
export function proposeSkip(
  room: Room,
  member: RoomMember,
  msg: { segmentType: SegmentType; isEpisode: boolean; segmentStartTicks: number; toTicks: number },
  now: number,
): boolean {
  if (!room.itemId || room.pendingSkip) return false;
  if (msg.toTicks <= msg.segmentStartTicks) return false;
  const key = skipKey(room.itemId, msg.segmentType, msg.segmentStartTicks);
  if (room.skipHistory.has(key)) return false;
  const settings = settingsForSegment(room.hostSettings ?? DEFAULT_PLAYBACK_SETTINGS, msg.segmentType, msg.isEpisode);
  if (!settings || settings.action !== "auto") return false;
  const position = wtPositionTicksAt(room, now);
  if (position < msg.segmentStartTicks - PROPOSAL_TOLERANCE_TICKS || position >= msg.toTicks) return false;
  room.pendingSkip = {
    segmentType: msg.segmentType,
    segmentStartTicks: msg.segmentStartTicks,
    toTicks: msg.toTicks,
    skipAtPositionTicks: position + settings.autoDelayMs * TICKS_PER_MS,
    byUserId: member.userId,
  };
  touch(room, now);
  armSkipTimer(room);
  return true;
}

/** Le décompte est arrivé à son terme : saut par barrière, passage réglé. */
export function executeSkip(room: Room, now: number): void {
  const pending = room.pendingSkip;
  if (!pending || !room.itemId) return;
  clearTimer(room);
  room.skipHistory.set(skipKey(room.itemId, pending.segmentType, pending.segmentStartTicks), pending.segmentStartTicks);
  room.pendingSkip = null;
  openBarrier(room, now, "skip", pending.toTicks, barrierParticipants(room), true, true);
}

/** Annule le décompte (croix, seek). `settled` : le passage est réglé, il ne
 *  sera pas re-proposé — sauf à rembobiner avant son début. Vrai s'il y en avait un. */
export function cancelPendingSkip(room: Room, settled: boolean): boolean {
  const pending = room.pendingSkip;
  clearTimer(room);
  if (!pending) return false;
  if (settled && room.itemId) {
    room.skipHistory.set(skipKey(room.itemId, pending.segmentType, pending.segmentStartTicks), pending.segmentStartTicks);
  }
  room.pendingSkip = null;
  return true;
}

/** Rembobiner avant le début d'un passage réglé le redemande. */
export function forgetSkipsFrom(room: Room, targetTicks: number): void {
  for (const [key, startTicks] of room.skipHistory) {
    if (targetTicks <= startTicks) room.skipHistory.delete(key);
  }
}

/** Changement de média, dissolution : plus rien à sauter ni à retenir. */
export function resetSkips(room: Room): void {
  clearTimer(room);
  room.pendingSkip = null;
  room.skipHistory.clear();
}
