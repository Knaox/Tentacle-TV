import type { Culprit, Health, ProducerDeath } from "@tentacle-tv/tv-core";
import type { PlayerLoad } from "../utils/playerLoadProbe";

/**
 * L'état que tient la reprise d'une lecture (`usePlaybackRecovery`) entre deux
 * observations — ce que `decideRecovery` (tv-core) reçoit, et de quoi le
 * calculer. Mutable, dans une ref : rien ici ne demande un rendu.
 */
export interface RecoveryState {
  stalledSince: number | null;
  lostSince: number | null;
  /** L'incident gardé ouvert par une relance (son rechargement n'est pas un arrêt). */
  openSince: number | null;
  /** Position quand l'incident s'est ouvert (perte, relance) — il se clôt quand elle avance. */
  incidentPos: number | null;
  buffered: { value: number; at: number };
  /** Dernière position vue, et le dernier signe de vie : la position qui avance,
   *  la mémoire qui grossit — l'échéance d'un transcodage qui se fait attendre. */
  lastPos: number;
  lastProgressAt: number | null;
  /** Ce qu'AVPlayer avait chargé à la lecture d'avant, pendant un arrêt (`playerLoadProbe`). */
  load: PlayerLoad | null;
  source: Health;
  culprit: Culprit | null;
  checkedAt: number | null;
  probing: boolean;
  manualProbe: boolean;
  stillDown: boolean;
  downSince: number | null;
  downWhat: Culprit | null;
  restarting: boolean;
  lastRestartAt: number | null;
  /** La relance en cours d'épreuve n'a pas encore fait avancer la lecture. */
  restartPending: boolean;
  vain: number;
  /** « Réessayer » demandé, pas encore servi. */
  retryAsked: boolean;
  /** Dernier rechargement de la MÊME session d'un transcodage (`useTranscodeReload`). */
  lastReloadAt: number | null;
  /** Le producteur de PrismCore : dernière lecture de son état, et sa dernière mort. */
  producerCheckedAt: number | null;
  producerChecking: boolean;
  producerDeath: ProducerDeath | null;
}

export const freshRecoveryState = (): RecoveryState => ({
  stalledSince: null, lostSince: null, openSince: null, incidentPos: null, buffered: { value: 0, at: Date.now() },
  lastPos: 0, lastProgressAt: null, load: null,
  source: "unknown", culprit: null, checkedAt: null, probing: false, manualProbe: false, stillDown: false,
  downSince: null, downWhat: null, restarting: false, lastRestartAt: null, restartPending: false, vain: 0,
  retryAsked: false, lastReloadAt: null, producerCheckedAt: null, producerChecking: false, producerDeath: null,
});
