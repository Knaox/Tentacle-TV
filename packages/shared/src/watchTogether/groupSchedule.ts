import {
  WT_LATE_START_SEEK_S, WT_PENDING_INTENT_MIN_MS, WT_PLAY_LATENCY_MAX_MS, WT_PRESEEK_TOLERANCE_S,
  WT_SEEK_LATENCY_MAX_S, WT_SEEK_LATENCY_MIN_S, type WtRoomStateDto,
} from "../types/watchTogether";

/**
 * Watch Together — l'arithmétique de la reprise planifiée et des intents en
 * vol, sans React : testée à part, lue par le moteur et la boucle de dérive
 * (api-client), donc par tous les lecteurs — web, bureau, mobile.
 */

export type PendingIntentKind = "play" | "pause" | "seek";

/** Un intent envoyé au serveur dont l'écho n'est pas encore revenu. */
export interface PendingIntent {
  kind: PendingIntentKind;
  /** Date.now() au-delà duquel on cesse de l'attendre (écho perdu). */
  until: number;
}

/** Une reprise planifiée est en attente : la salle joue, mais pas encore. */
export function isFutureAnchor(
  state: Pick<WtRoomStateDto, "paused" | "stateAtServerTime">,
  serverNow: number,
): boolean {
  return !state.paused && state.stateAtServerTime > serverNow;
}

/** Délai local avant d'appeler play() : l'instant de reprise, moins la latence
 *  de démarrage mesurée de CE lecteur (il part un peu avant pour être à l'heure). */
export function computePlayDelayMs(
  anchorServerTime: number,
  serverNow: number,
  playLatencyMs: number | null,
): number {
  return Math.max(0, anchorServerTime - serverNow - (playLatencyMs ?? 0));
}

/** Jusqu'à quand un intent reste en vol : au moins le plancher, ou deux
 *  allers-retours quand le réseau est lent. */
export function pendingIntentUntil(now: number, rttMs: number | null): number {
  return now + Math.max(WT_PENDING_INTENT_MIN_MS, 2 * (rttMs ?? 0));
}

/** Latence de démarrage lissée (moyenne mobile exponentielle, 0,3), bornée. */
export function updatePlayLatency(previous: number | null, measuredMs: number): number {
  const clamped = Math.min(WT_PLAY_LATENCY_MAX_MS, Math.max(0, measuredMs));
  return previous === null ? Math.round(clamped) : Math.round(previous * 0.7 + clamped * 0.3);
}

/** Se pré-caler avant une reprise planifiée ? En dessous de la tolérance, un
 *  seek coûterait plus qu'il ne corrige — 40 ms sur le web, davantage sur
 *  mpv, dont le seek précis atterrit à l'image (WT_BARRIER_PRESEEK_MPV_S). */
export function needsPreseek(positionS: number, targetS: number, toleranceS: number = WT_PRESEEK_TOLERANCE_S): boolean {
  return Math.abs(positionS - targetS) > toleranceS;
}

/** Latence de seek lissée (moyenne mobile exponentielle, 0,3), bornée — le
 *  lookahead d'un seek dur en lecture. */
export function updateSeekLatency(previous: number | null, measuredS: number): number {
  const clamped = Math.min(WT_SEEK_LATENCY_MAX_S, Math.max(WT_SEEK_LATENCY_MIN_S, measuredS));
  return previous === null ? clamped : previous * 0.7 + clamped * 0.3;
}

/**
 * Juste après une reprise planifiée, l'écart à la salle (secondes, > 0 = en
 * retard) se corrige-t-il d'UN seek ? Dans les DEUX sens : à ±5 %, une
 * seconde prendrait vingt secondes, en avance comme en retard (défaut mesuré
 * au banc le 20/10 : un membre qui arrive partait 200 à 300 ms en avance et
 * mettait 10 s à passer sous 100 ms).
 */
export function needsStartCorrection(behindS: number): boolean {
  return Math.abs(behindS) > WT_LATE_START_SEEK_S;
}

/** Un seek dur de la boucle de dérive, suivi jusqu'à la REPRISE de la lecture. */
export interface HardSeekWatch {
  /** Instant du seek (ms). */
  at: number;
  /** Cible visée (secondes film). */
  targetS: number;
  /** Position lue au battement précédent, null au premier. */
  lastPosS: number | null;
}

/** Posé : à moins de ça de la cible, ou au-delà (secondes). */
export const HARD_SEEK_LANDED_S = 0.5;
/** Au-delà, on cesse d'attendre la reprise : un nouveau seek redevient possible. */
export const HARD_SEEK_WAIT_MAX_MS = 5_000;

/**
 * Où en est un seek dur : `resumed` quand la lecture AVANCE de nouveau près
 * de la cible (la latence mesurée court jusque-là, attente des segments
 * comprise — c'est elle que le lookahead doit couvrir) ; `waiting` tant
 * qu'elle n'a pas repris : AUCUN nouveau seek dur (un transcodage, sinon,
 * re-sautait toutes les 1,8 s sans jamais reprendre — vu au banc) ;
 * `expired` passé HARD_SEEK_WAIT_MAX_MS.
 */
export function hardSeekProgress(
  watch: HardSeekWatch,
  posS: number,
  now: number,
): { state: "resumed"; latencyS: number } | { state: "waiting" } | { state: "expired" } {
  const advancing = watch.lastPosS !== null && posS - watch.lastPosS > 0.02;
  if (advancing && posS >= watch.targetS - HARD_SEEK_LANDED_S) {
    return { state: "resumed", latencyS: (now - watch.at) / 1000 };
  }
  return now - watch.at > HARD_SEEK_WAIT_MAX_MS ? { state: "expired" } : { state: "waiting" };
}
