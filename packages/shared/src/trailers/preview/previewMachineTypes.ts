/**
 * Les TYPES de la machine de l'aperçu (`previewMachine.ts`) : ses phases, son
 * état, ses évènements, son état initial.
 */

export type TrailerPreviewPhase =
  | "idle"
  | "intent"
  | "fetching"
  | "buffering"
  | "ready"
  | "shown"
  | "ended"
  | "failed";

/** Pourquoi un aperçu n'a pas abouti : pas de bande-annonce lisible, ou la vidéo a lâché. */
export type TrailerPreviewFailure = "missing" | "video";

export interface TrailerPreviewState {
  readonly phase: TrailerPreviewPhase;
  readonly hovered: boolean;
  readonly blocked: boolean;
  /** Début du survol qui a ouvert le cycle en cours : l'intention et la révélation en partent. */
  readonly since: number | null;
  /** Dernier mouvement du pointeur pendant l'intention : la demande attend qu'il s'arrête. */
  readonly stillSince: number | null;
  /**
   * Échéance de la première image : en `buffering`, et en `shown` tant que la
   * vidéo n'a pas rejoint l'image du titre (révélation sur l'image).
   */
  readonly readyBy: number | null;
  /** La première image de la vidéo est décodée (ce cycle). */
  readonly videoReady: boolean;
  /**
   * L'image du titre (son fond 16:9) est chargée et décodée dans la
   * mini-carte : elle peut se montrer AVANT la vidéo, qui la rejoint en fondu
   * (ce cycle). Sans elle, la révélation attend la première image.
   */
  readonly stillReady: boolean;
  /** Fin du fondu de sortie d'une lecture montrée : la vidéo reste montée jusque-là. */
  readonly exitUntil: number | null;
  /** Le fondu en cours vient d'un simple départ du survol : un retour le reprend. */
  readonly resumable: boolean;
  /** Numéro du cycle (un par survol abouti à l'intention) : une vidéo neuve à chaque cycle. */
  readonly cycle: number;
  readonly failure: TrailerPreviewFailure | null;
  /** Échéance d'une nouvelle demande après un refus passager (phase `fetching`). */
  readonly retryAt: number | null;
  /** Refus passagers déjà essuyés pendant ce cycle. */
  readonly retries: number;
  /** Numéro de la demande du cycle : il monte quand une nouvelle demande est due. */
  readonly attempt: number;
}

export type TrailerPreviewEvent =
  | { type: "hover"; at: number }
  | { type: "unhover"; at: number }
  /** Le pointeur a bougé sur la carte (au-delà du seuil), ou la molette a tourné : l'intention repart de là. */
  | { type: "move"; at: number }
  | { type: "block"; at: number }
  | { type: "unblock"; at: number }
  /** Une échéance est peut-être passée (minuterie du crochet). */
  | { type: "tick"; at: number }
  | { type: "streamFound"; at: number }
  | { type: "streamMissing"; at: number }
  /** Refus passager : redemander à `retryAt` si le survol tient (deux fois au plus). */
  | { type: "streamRetry"; at: number; retryAt: number }
  | { type: "videoReady"; at: number }
  /** L'image du titre est prête dans la mini-carte : la révélation n'attend plus la vidéo. */
  | { type: "stillReady"; at: number }
  | { type: "videoFailed"; at: number }
  | { type: "videoEnded"; at: number }
  /** Un autre aperçu a pris la place (un seul à la fois). */
  | { type: "preempted"; at: number }
  /** La carte montre un AUTRE titre sous le même survol : le cycle en cours est abandonné. */
  | { type: "restart"; at: number };

export const INITIAL_TRAILER_PREVIEW_STATE: TrailerPreviewState = {
  phase: "idle",
  hovered: false,
  blocked: false,
  since: null,
  stillSince: null,
  readyBy: null,
  videoReady: false,
  stillReady: false,
  exitUntil: null,
  resumable: false,
  cycle: 0,
  failure: null,
  retryAt: null,
  retries: 0,
  attempt: 0,
};
