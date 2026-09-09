/**
 * La cause d'un passage hors ligne, et sa priorité — LOGIQUE PURE, à côté de
 * la machine à états.
 *
 * `applyProbe` compose ce que le magasin faisait à la main : l'hystérésis de
 * joignabilité, celle de la latence, et la CAUSE. Deux règles y vivent :
 * - sans lien côté appareil (`linkDown`), un échec de sonde reste « network »
 *   — une sonde qui échoue faute de lien n'accuse pas le serveur. Le magasin
 *   écrasait la cause à la première sonde ratée, sans même republier son
 *   instantané ;
 * - un changement de cause SEULE vaut instantané à reconstruire : ce que le
 *   voile et le bandeau disent en dépend.
 */

import {
  applyProbeResult,
  initialHysteresis,
  LATENCY_HYSTERESIS,
  SLOW_LINK_MS,
  type HysteresisConfig,
  type HysteresisState,
} from "./connectivityMachine";

/**
 * Pourquoi on est hors ligne. `"network"` : le téléphone n'a pas de lien ;
 * `"timeout"` : le serveur n'a pas répondu à temps — une connexion qui ne
 * permet pas de le joindre, pas un serveur tombé (celui-là répond vite, en
 * erreur : `"backend"`, ou `"jellyfin"` derrière lui).
 */
export type OfflineReason = "backend" | "jellyfin" | "network" | "timeout" | null;

/** La cause est du côté de l'APPAREIL : un voile « le serveur fait une pause » mentirait. */
export function isDeviceSideReason(reason: OfflineReason): boolean {
  return reason === "network" || reason === "timeout";
}

export interface ProbeMeasure {
  ok: boolean;
  reason: OfflineReason;
  /** Latence de `/api/health` — `null` si rien n'a pu être mesuré. */
  latencyMs: number | null;
}

export interface ConnectivityCore {
  hysteresis: HysteresisState;
  /** Hystérésis de la LATENCE — `reachable` y porte « dernière mesure rapide ». */
  latency: HysteresisState;
  reason: OfflineReason;
}

export const initialConnectivityCore: ConnectivityCore = {
  hysteresis: initialHysteresis,
  latency: initialHysteresis,
  reason: null,
};

export interface ProbeApplied {
  next: ConnectivityCore;
  /** Joignabilité, qualité OU cause ont changé : l'instantané est à reconstruire. */
  changed: boolean;
  /** Une sonde de confirmation rapprochée est souhaitable. */
  wantConfirm: boolean;
}

/**
 * Applique une mesure. La joignabilité suit son hystérésis ; la cause est
 * celle de la sonde, sauf sans lien côté appareil où elle reste « network » ;
 * la qualité du lien suit la latence quand il y en a une (sans mesure, on
 * garde la dernière qualité connue).
 */
export function applyProbe(
  core: ConnectivityCore,
  measure: ProbeMeasure,
  now: number,
  cfg: HysteresisConfig,
  linkDown = false,
): ProbeApplied {
  const outcome = applyProbeResult(core.hysteresis, measure.ok, now, cfg);
  const reason: OfflineReason = measure.ok ? null : linkDown ? "network" : measure.reason;
  let latency = core.latency;
  let qualityFlipped = false;
  if (measure.latencyMs !== null) {
    const quality = applyProbeResult(core.latency, measure.latencyMs < SLOW_LINK_MS, now, LATENCY_HYSTERESIS);
    latency = quality.next;
    qualityFlipped = quality.flipped;
  }
  return {
    next: { hysteresis: outcome.next, latency, reason },
    changed: outcome.flipped || qualityFlipped || reason !== core.reason,
    wantConfirm: outcome.wantConfirm,
  };
}
