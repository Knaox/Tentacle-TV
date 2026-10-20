import type { LiveContent } from "@tentacle-tv/offline-core";

/** Ce que l'activité affiche, déjà dans la langue de l'app. */
export interface LiveTexts {
  /** Le titre, la série et son compte, ou le compte seul. */
  headline: string;
  /** L'état, en toutes lettres : « Prêt dans 12 min », « En attente du Wi-Fi »… */
  status: string;
  /** Le libellé posé devant le compte à rebours natif (« Prêt dans »). */
  readyInLabel: string;
  /**
   * Où mène un toucher : l'écran « Sur cet appareil », où sont les transferts
   * (demande de Damien, 20/10 — le titre seul n'y montrait pas leur avancée).
   * La notification « Prêt à regarder hors ligne », elle, mène au titre.
   */
  deepLink: string;
}

type Translate = (key: string, params?: Record<string, unknown>) => string;

/** Une durée courte, arrondie à la minute : « 12 min », « 1 h 05 min », « moins d'une minute ». */
export function liveDuration(ms: number, t: Translate): string {
  const minutes = Math.round(Math.max(0, ms) / 60_000);
  if (minutes < 1) return t("offline:liveDurationSoon");
  if (minutes < 60) return t("offline:liveDurationMinutes", { minutes });
  return t("offline:liveDurationHours", { hours: Math.floor(minutes / 60), minutes: String(minutes % 60).padStart(2, "0") });
}

const PHASE_KEYS = {
  estimating: "offline:liveEstimating",
  finalizing: "offline:liveFinalizing",
  waitingWifi: "offline:liveWaitingWifi",
  waitingNetwork: "offline:liveWaitingNetwork",
  paused: "offline:livePaused",
  retrying: "offline:liveRetrying",
} as const;

/**
 * Les mots de l'activité. Un compte à rebours n'est écrit QUE pour une phase
 * `transferring` qui a une fin : une attente se dit, elle ne se décompte pas.
 */
export function liveTexts(
  content: LiveContent,
  nowMs: number,
  t: Translate,
  titleOf: (itemId: string) => string | null,
): LiveTexts {
  const single = content.single;
  const headline =
    single !== null
      ? (titleOf(single.itemId) ?? single.title ?? t("offline:liveCount", { count: 1 }))
      : content.seriesName !== null
        ? t("offline:liveSeries", { series: content.seriesName, count: content.remaining })
        : t("offline:liveCount", { count: content.remaining });
  const status =
    content.phase === "transferring" && content.endsAtMs !== null
      ? t("offline:liveReadyInText", { time: liveDuration(content.endsAtMs - nowMs, t) })
      : t(content.phase === "transferring" ? PHASE_KEYS.estimating : PHASE_KEYS[content.phase]);
  return {
    headline,
    status,
    readyInLabel: t("offline:liveReadyIn"),
    deepLink: "tentacle://on-device",
  };
}
