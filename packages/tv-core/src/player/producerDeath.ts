import { PROBE_EVERY_MS, STALL_GRACE_MS } from "./playbackRecovery";

/**
 * La mort du PRODUCTEUR de PrismCore (le remuxeur qui fabrique le flux local
 * d'une lecture directe sur Apple TV) — décision pure, lue par la reprise
 * (`usePlaybackRecovery`).
 *
 * AVPlayer ne la dit jamais : il relance ses segments sans fin (mesuré par
 * « calage » : 404 ou -1004 rejoués, l'élément n'échoue pas). On ne voit
 * qu'un arrêt ; l'état du producteur (`PrismBridge.status`) dit s'il repartira :
 * - `failed` : il a levé (`remuxError`, un DTS reculé refusé par le muxeur…)
 *   — rien ne sera plus produit. Une relance NEUVE (une autre session) ; s'il
 *   remeurt au même endroit, le fichier y bloque la lecture directe : le
 *   chemin serveur, à la position, et on le dit ;
 * - vivant : une source coupée ou en 503 ne le tue pas, il réessaie (plus de
 *   4 min 30 mesurées) et repart au retour — c'est l'affaire de la sonde ;
 * - inconnu : la session a été stoppée ou remplacée — rien à conclure.
 */

/** Ce que rend `PrismBridge.status` (les champs lus ici). */
export interface ProducerStatus {
  known: boolean;
  failed: boolean;
}

/** Une mort relevée : sur quelle session, à quelle position. */
export interface ProducerDeath {
  gen: number;
  at: number;
}

/** « Au même endroit » : la mort précédente à moins de tant de la position. */
export const SAME_PLACE_S = 30;

export type ProducerAction = "none" | "restart" | "serverPath";

/**
 * Lire l'état du producteur ? Un arrêt sur le flux LOCAL, passé la même grâce
 * que la reprise, une lecture au plus par période de sonde, rien pendant une
 * relance.
 */
export function shouldCheckProducer(s: {
  prismCore: boolean;
  now: number;
  stalledSince: number | null;
  lastCheckAt: number | null;
  restarting: boolean;
}): boolean {
  if (!s.prismCore || s.restarting || s.stalledSince === null) return false;
  if (s.now - s.stalledSince < STALL_GRACE_MS) return false;
  return s.lastCheckAt === null || s.now - s.lastCheckAt >= PROBE_EVERY_MS;
}

/** Que faire de ce que dit le producteur, à cette position, après cette mort-là ? */
export function decideProducerDeath(s: {
  status: ProducerStatus | null;
  position: number;
  previous: ProducerDeath | null;
}): ProducerAction {
  if (!s.status?.known || !s.status.failed) return "none";
  if (s.previous && Math.abs(s.position - s.previous.at) <= SAME_PLACE_S) return "serverPath";
  return "restart";
}
