import {
  WT_PENDING_INTENT_MIN_MS, WT_PLAY_LATENCY_MAX_MS, WT_PRESEEK_TOLERANCE_S,
  type WtRoomStateDto,
} from "@tentacle-tv/shared";

/**
 * Watch Together — l'arithmétique de la reprise planifiée et des intents en
 * vol, sans React : testée à part, lue par le moteur et la boucle de dérive.
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
