import { TRAILER_PREVIEW_TIMING, type TrailerPreviewTiming } from "./previewTiming";

/**
 * La machine de l'aperçu de bande-annonce au survol — un réducteur PUR : le
 * temps n'y entre que par les évènements (`at`, en millisecondes), et ce qui
 * doit arriver plus tard se lit dans `nextTrailerPreviewDeadline`. Le crochet
 * du web n'arme qu'UNE minuterie, sur cette échéance, et rend `tick`.
 *
 *   idle ─survol→ intent ─350 ms→ fetching ─flux→ buffering ─1re image→ ready ─1 s→ shown
 *                                     │ absent        │ erreur, 8 s       │ erreur      │ fin
 *                                     └→ failed ←─────┴───────────────────┘            └→ ended
 *
 * Sortie du survol, blocage : retour à `idle` de partout. Une lecture MONTRÉE
 * ne disparaît pas d'un coup : la vidéo reste montée le temps du fondu de
 * sortie (`exitUntil`), et un retour du survol pendant ce fondu la reprend là
 * où elle en était (`resumable`) — un pointeur qui glisse de la carte à la
 * mini-carte ne coupe rien.
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
  /** Échéance de la première image (phase `buffering`). */
  readonly readyBy: number | null;
  /** Fin du fondu de sortie d'une lecture montrée : la vidéo reste montée jusque-là. */
  readonly exitUntil: number | null;
  /** Le fondu en cours vient d'un simple départ du survol : un retour le reprend. */
  readonly resumable: boolean;
  /** Numéro du cycle (un par survol abouti à l'intention) : une vidéo neuve à chaque cycle. */
  readonly cycle: number;
  readonly failure: TrailerPreviewFailure | null;
}

export type TrailerPreviewEvent =
  | { type: "hover"; at: number }
  | { type: "unhover"; at: number }
  | { type: "block"; at: number }
  | { type: "unblock"; at: number }
  /** Une échéance est peut-être passée (minuterie du crochet). */
  | { type: "tick"; at: number }
  | { type: "streamFound"; at: number }
  | { type: "streamMissing"; at: number }
  | { type: "videoReady"; at: number }
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
  readyBy: null,
  exitUntil: null,
  resumable: false,
  cycle: 0,
  failure: null,
};

/** Les phases d'un aperçu EN COURS — celles qu'un survol perdu ou un blocage interrompt. */
const ACTIVE: ReadonlySet<TrailerPreviewPhase> = new Set(["intent", "fetching", "buffering", "ready", "shown"]);
/** Les phases où la vidéo existe (cachée puis montrée). */
const VIDEO: ReadonlySet<TrailerPreviewPhase> = new Set(["buffering", "ready", "shown"]);

/** Un nouveau cycle : l'intention court depuis `at`. Un fondu qui ne se reprend pas est coupé net. */
function begin(state: TrailerPreviewState, at: number): TrailerPreviewState {
  return {
    ...state,
    phase: "intent",
    since: at,
    readyBy: null,
    exitUntil: null,
    resumable: false,
    cycle: state.cycle + 1,
    failure: null,
  };
}

/** Quitte l'aperçu en cours ; une lecture montrée garde sa vidéo le temps du fondu. */
function leave(
  state: TrailerPreviewState,
  at: number,
  phase: "idle" | "ended" | "failed",
  options: { resumable?: boolean; failure?: TrailerPreviewFailure; timing: TrailerPreviewTiming },
): TrailerPreviewState {
  const wasShown = state.phase === "shown";
  return {
    ...state,
    phase,
    readyBy: null,
    exitUntil: wasShown ? at + options.timing.exitMs : state.exitUntil,
    resumable: wasShown ? options.resumable === true : state.resumable && options.resumable === true,
    failure: options.failure ?? (phase === "failed" ? state.failure : null),
  };
}

function revealAt(state: TrailerPreviewState, timing: TrailerPreviewTiming): number {
  return (state.since ?? 0) + timing.revealMs;
}

/** Fait passer toutes les échéances atteintes à `at` (une minuterie en retard en saute plusieurs). */
function elapse(state: TrailerPreviewState, at: number, timing: TrailerPreviewTiming): TrailerPreviewState {
  let next = state;
  if (next.exitUntil !== null && at >= next.exitUntil) next = { ...next, exitUntil: null, resumable: false };
  if (next.phase === "intent" && next.since !== null && at >= next.since + timing.intentMs) {
    next = { ...next, phase: "fetching" };
  }
  if (next.phase === "buffering" && next.readyBy !== null && at >= next.readyBy) {
    next = leave(next, at, "failed", { failure: "video", timing });
  }
  if (next.phase === "ready" && at >= revealAt(next, timing)) next = { ...next, phase: "shown" };
  return next;
}

/**
 * Le réducteur. `timing` n'est passé que par les tests ; le crochet utilise
 * `trailerPreviewReducer`, lié aux temps du produit.
 */
export function reduceTrailerPreview(
  state: TrailerPreviewState,
  event: TrailerPreviewEvent,
  timing: TrailerPreviewTiming = TRAILER_PREVIEW_TIMING,
): TrailerPreviewState {
  const at = event.at;
  // Les échéances passées d'abord : un évènement arrivé après elles ne les efface pas.
  const state0 = event.type === "tick" ? state : elapse(state, at, timing);
  switch (event.type) {
    case "tick":
      return elapse(state, at, timing);
    case "hover": {
      if (state0.hovered) return state0;
      const hovered = { ...state0, hovered: true };
      if (hovered.blocked) return hovered;
      // Retour pendant le fondu d'une lecture qu'on vient de quitter : elle reprend.
      if (hovered.exitUntil !== null && hovered.resumable) {
        return { ...hovered, phase: "shown", exitUntil: null, resumable: false };
      }
      return begin(hovered, at);
    }
    case "unhover": {
      if (!state0.hovered) return state0;
      const unhovered = { ...state0, hovered: false };
      return ACTIVE.has(unhovered.phase) || unhovered.phase === "ended" || unhovered.phase === "failed"
        ? leave(unhovered, at, "idle", { resumable: true, timing })
        : unhovered;
    }
    case "block": {
      if (state0.blocked) return state0;
      const blocked = { ...state0, blocked: true };
      return ACTIVE.has(blocked.phase) ? leave(blocked, at, "idle", { timing }) : blocked;
    }
    case "unblock": {
      if (!state0.blocked) return state0;
      const unblocked = { ...state0, blocked: false };
      // Un aperçu interrompu par le blocage repart ; un aperçu déjà fini ou
      // sans bande-annonce pendant ce survol ne se rejoue pas.
      return unblocked.hovered && unblocked.phase === "idle" ? begin(unblocked, at) : unblocked;
    }
    case "streamFound":
      return state0.phase === "fetching"
        ? { ...state0, phase: "buffering", readyBy: at + timing.readyTimeoutMs }
        : state0;
    case "streamMissing":
      return state0.phase === "fetching" ? leave(state0, at, "failed", { failure: "missing", timing }) : state0;
    case "videoReady":
      if (state0.phase !== "buffering") return state0;
      return { ...state0, phase: at >= revealAt(state0, timing) ? "shown" : "ready", readyBy: null };
    case "videoFailed":
      return VIDEO.has(state0.phase) ? leave(state0, at, "failed", { failure: "video", timing }) : state0;
    case "videoEnded":
      if (state0.phase === "shown") return leave(state0, at, "ended", { timing });
      // Une vidéo finie avant d'avoir été montrée n'avait rien à montrer.
      return VIDEO.has(state0.phase) ? leave(state0, at, "failed", { failure: "video", timing }) : state0;
    case "preempted":
      return ACTIVE.has(state0.phase) ? leave(state0, at, "ended", { timing }) : state0;
    case "restart": {
      // Rien ne se reprend d'un autre titre : la vidéo d'avant part sans fondu.
      const dropped = { ...state0, phase: "idle" as const, readyBy: null, exitUntil: null, resumable: false, failure: null };
      return dropped.hovered && !dropped.blocked ? begin(dropped, at) : dropped;
    }
  }
}

/** Le réducteur du produit (temps de `TRAILER_PREVIEW_TIMING`), pour `useReducer`. */
export function trailerPreviewReducer(state: TrailerPreviewState, event: TrailerPreviewEvent): TrailerPreviewState {
  return reduceTrailerPreview(state, event);
}

/** La prochaine échéance (ms) à surveiller, `null` s'il n'y a rien à attendre. */
export function nextTrailerPreviewDeadline(
  state: TrailerPreviewState,
  timing: TrailerPreviewTiming = TRAILER_PREVIEW_TIMING,
): number | null {
  const deadlines: number[] = [];
  if (state.exitUntil !== null) deadlines.push(state.exitUntil);
  if (state.phase === "intent" && state.since !== null) deadlines.push(state.since + timing.intentMs);
  if (state.phase === "buffering" && state.readyBy !== null) deadlines.push(state.readyBy);
  if (state.phase === "ready") deadlines.push(revealAt(state, timing));
  return deadlines.length ? Math.min(...deadlines) : null;
}

/** La vidéo doit exister (chargée cachée, montrée, ou en fondu de sortie). */
export function trailerPreviewMounted(state: TrailerPreviewState): boolean {
  return VIDEO.has(state.phase) || state.exitUntil !== null;
}

/** La mini-carte se montre : première image là, seconde écoulée, survol tenu, rien ne bloque. */
export function trailerPreviewVisible(state: TrailerPreviewState): boolean {
  return state.phase === "shown";
}

/** La vidéo joue : montrée, ou dans son fondu de sortie (le son y décroît). */
export function trailerPreviewPlaying(state: TrailerPreviewState): boolean {
  return state.phase === "shown" || state.exitUntil !== null;
}

/**
 * Le flux est demandé (ou gardé), et l'aperçu occupe la place unique (cf.
 * `previewArbiter.ts`) : de l'intention passée jusqu'à la fin de la lecture.
 */
export function trailerPreviewWantsStream(state: TrailerPreviewState): boolean {
  return state.phase === "fetching" || VIDEO.has(state.phase);
}
