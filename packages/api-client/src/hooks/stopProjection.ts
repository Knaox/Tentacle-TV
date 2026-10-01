import { TICKS_PER_SECOND, type UserItemData } from "@tentacle-tv/shared";

/**
 * Ce que Jellyfin ÉCRIRA à l'arrêt d'une lecture, calculé de ce côté-ci.
 *
 * # Pourquoi le calculer nous-mêmes
 *
 * Jellyfin 12.1 accuse l'arrêt (`/Sessions/Playing/Stopped`, 2xx) AVANT
 * d'avoir écrit la reprise. Mesuré depuis la TV sur quatre arrêts : écrite
 * aussitôt (deux fois), après 4 à 12 s (une fois), jamais (une fois — l'état
 * final était exactement celui du rapport de DÉBUT de cette lecture : position
 * de l'arrêt précédent, `PlayCount` + 1, `LastPlayedDate` du début ; une
 * écriture hors d'ordre). Relue aussitôt après l'arrêt, la fiche affichait
 * « Lecture » et relançait à 0:00 un film quitté à 30 min.
 *
 * # La règle
 *
 * Celle de Jellyfin (`UserDataManager.UpdatePlayState`), avec ses réglages par
 * défaut — seul `MaxResumePct` est lu du serveur (`/api/config/autoplay`) :
 * - sous `MinResumePct` (5 %) : position 0, l'état « vu » n'est pas touché ;
 * - au-delà de `MaxResumePct` (90 %), ou au bout : « vu », position 0 ;
 * - un titre de moins de `MinResumeDuration` (5 min) : « vu », position 0 ;
 * - sinon la position, et plus « vu » : un titre repris n'est plus terminé
 *   (`clearPlayedWhenResumable` défait la contradiction côté serveur).
 */
export interface StopProjection {
  positionTicks: number;
  /** `null` : Jellyfin ne touchera pas à l'état « vu ». */
  played: boolean | null;
}

export const RESUME_RULES = { minResumePct: 5, maxResumePct: 90, minResumeDurationSeconds: 300 } as const;

/** `null` : durée inconnue — le serveur tranche seul. */
export function projectStop(a: {
  positionSeconds: number;
  runtimeTicks: number | undefined;
  maxResumePct?: number;
}): StopProjection | null {
  const runtime = a.runtimeTicks ?? 0;
  if (!(runtime > 0) || !Number.isFinite(a.positionSeconds)) return null;
  const position = Math.max(0, Math.round(a.positionSeconds * TICKS_PER_SECOND));
  const pct = (position / runtime) * 100;
  const maxPct = a.maxResumePct ?? RESUME_RULES.maxResumePct;
  if (position === 0 || pct < RESUME_RULES.minResumePct) return { positionTicks: 0, played: null };
  if (pct > maxPct || position >= runtime) return { positionTicks: 0, played: true };
  if (runtime / TICKS_PER_SECOND < RESUME_RULES.minResumeDurationSeconds) return { positionTicks: 0, played: true };
  return { positionTicks: position, played: false };
}

/** Le patch local d'une projection : ce que la fiche et les listes doivent montrer. */
export function projectionPatch(p: StopProjection, runtimeTicks: number): Partial<UserItemData> {
  const patch: Partial<UserItemData> = {
    PlaybackPositionTicks: p.positionTicks,
    PlayedPercentage: p.positionTicks > 0 ? (p.positionTicks / runtimeTicks) * 100 : 0,
  };
  if (p.played !== null) patch.Played = p.played;
  return patch;
}

/**
 * Le milieu du titre, là où toute configuration raisonnable de Jellyfin garde
 * une reprise : seuls ces arrêts-là sont défendus contre une relecture en
 * retard, et réparés. Près du début ou de la fin, le verdict du serveur (ses
 * propres seuils, peut-être réglés autrement) n'est jamais combattu.
 */
export function stopWorthDefending(p: StopProjection, runtimeTicks: number, maxResumePct: number = RESUME_RULES.maxResumePct): boolean {
  if (p.played !== false || runtimeTicks / TICKS_PER_SECOND < 600) return false;
  const pct = (p.positionTicks / runtimeTicks) * 100;
  return pct >= 10 && pct <= maxResumePct - 5;
}

/** Deux positions à moins de 3 s l'une de l'autre disent la même chose. */
const AGREE_TICKS = 3 * TICKS_PER_SECOND;
/** Les horloges du téléviseur et du serveur : l'écart toléré, en faveur du serveur. */
const CLOCK_SKEW_MS = 2_000;

export type ServerVerdict = "agrees" | "newer" | "older";

/**
 * Ce que dit une réponse du serveur face à notre arrêt.
 * - `newer` : LA DATE GAGNE — une lecture a commencé après notre arrêt (un
 *   autre appareil, ou celui-ci) ; le serveur a raison. `LastPlayedDate` est
 *   posée au DÉBUT d'une lecture, jamais à l'arrêt.
 * - `agrees` : il a écrit notre arrêt.
 * - `older` : une réponse d'avant l'écriture (en retard, ou écrasée).
 */
export function judgeServerUserData(
  stop: StopProjection & { stoppedAt: number },
  data: Partial<Pick<UserItemData, "PlaybackPositionTicks" | "Played" | "LastPlayedDate">>,
): ServerVerdict {
  const last = data.LastPlayedDate ? Date.parse(data.LastPlayedDate) : Number.NaN;
  if (Number.isFinite(last) && last >= stop.stoppedAt - CLOCK_SKEW_MS) return "newer";
  const closeEnough = Math.abs((data.PlaybackPositionTicks ?? 0) - stop.positionTicks) <= AGREE_TICKS;
  const playedMatches = stop.played === null || !!data.Played === stop.played;
  return closeEnough && playedMatches ? "agrees" : "older";
}
