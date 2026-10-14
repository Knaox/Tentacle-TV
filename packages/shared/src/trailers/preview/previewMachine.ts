import { TRAILER_PREVIEW_TIMING, type TrailerPreviewTiming } from "./previewTiming";
import { ACTIVE, VIDEO, awaitingVideo, intentAt, revealAt, revealable } from "./previewMachineRules";
import type { TrailerPreviewEvent, TrailerPreviewFailure, TrailerPreviewState } from "./previewMachineTypes";

/**
 * La machine de l'aperçu de bande-annonce au survol — un réducteur PUR : le
 * temps n'y entre que par les évènements (`at`, en millisecondes), et ce qui
 * doit arriver plus tard se lit dans `nextTrailerPreviewDeadline`. Le crochet
 * du web n'arme qu'UNE minuterie, sur cette échéance, et rend `tick`.
 *
 *   idle ─survol→ intent ─250 ms→ fetching ─flux→ buffering ─1re image→ ready ─800 ms→ shown
 *                                     │ absent        │ erreur, 8 s       │ erreur      │ fin
 *                                     └→ failed ←─────┴───────────────────┘            └→ ended
 *
 * RÉVÉLATION SUR L'IMAGE : le flux trouvé, le serveur a VÉRIFIÉ que la
 * bande-annonce se lit ; quand son premier fragment vidéo est arrivé ici
 * (`videoFragment` : le flux coule) et que la mini-carte a l'image du titre
 * (`stillReady`), elle se montre au rendez-vous (800 ms) sans attendre la
 * première image — `buffering ─fragment + image du titre, 800 ms→ shown` —
 * et la vidéo la rejoint en fondu (`videoReady`). Un flux bloqué avant son
 * premier fragment ne révèle rien. Si la première image ne vient pas avant
 * `readyBy` (8 s après le flux), c'est un échec : la mini-carte s'efface.
 *
 * L'intention demande aussi un pointeur ARRÊTÉ (`intentStillMs`) : chaque
 * mouvement (`move`, au-delà du seuil de la carte) la repousse. Un balayage
 * de rangée ne demande donc rien au serveur, même lent.
 *
 * Un refus PASSAGER (429, panne réseau) garde `fetching` : l'aperçu attend
 * l'échéance que le serveur a dite (`retryAt`), puis redemande (`attempt`),
 * deux fois au plus — un survol qui s'arrête sur une carte après en avoir
 * balayé une rangée finit par avoir son aperçu.
 *
 * Sortie du survol, blocage : retour à `idle` de partout. Une lecture MONTRÉE
 * ne disparaît pas d'un coup : la vidéo reste montée le temps du fondu de
 * sortie (`exitUntil`), et un retour du survol pendant ce fondu la reprend là
 * où elle en était (`resumable`) — un pointeur qui glisse de la carte à la
 * mini-carte ne coupe rien.
 */

export * from "./previewMachineTypes";
export * from "./previewMachineSelectors";

/** Un nouveau cycle : l'intention court depuis `at`. Un fondu qui ne se reprend pas est coupé net. */
function begin(state: TrailerPreviewState, at: number): TrailerPreviewState {
  return {
    ...state,
    phase: "intent",
    since: at,
    stillSince: at,
    readyBy: null,
    videoReady: false,
    videoFragment: false,
    stillReady: false,
    exitUntil: null,
    resumable: false,
    cycle: state.cycle + 1,
    failure: null,
    retryAt: null,
    retries: 0,
    attempt: 0,
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
    retryAt: null,
    exitUntil: wasShown ? at + options.timing.exitMs : state.exitUntil,
    resumable: wasShown ? options.resumable === true : state.resumable && options.resumable === true,
    failure: options.failure ?? (phase === "failed" ? state.failure : null),
  };
}

/** Fait passer toutes les échéances atteintes à `at` (une minuterie en retard en saute plusieurs). */
function elapse(state: TrailerPreviewState, at: number, timing: TrailerPreviewTiming): TrailerPreviewState {
  let next = state;
  if (next.exitUntil !== null && at >= next.exitUntil) next = { ...next, exitUntil: null, resumable: false };
  if (next.phase === "intent" && next.since !== null && at >= intentAt(next, timing)) {
    next = { ...next, phase: "fetching" };
  }
  if (next.phase === "fetching" && next.retryAt !== null && at >= next.retryAt) {
    next = { ...next, retryAt: null, attempt: next.attempt + 1 };
  }
  // La vidéo n'a jamais eu sa première image — cachée, ou montrée sur l'image du titre : échec, sortie.
  if (awaitingVideo(next) && at >= (next.readyBy as number)) {
    next = leave(next, at, "failed", { failure: "video", timing });
  }
  if (revealable(next, at, timing)) next = { ...next, phase: "shown" };
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
      // Retour pendant le fondu d'une lecture qu'on vient de quitter : elle reprend
      // (montrée sur l'image du titre, la vidéo a de nouveau jusqu'à `readyTimeoutMs`).
      if (hovered.exitUntil !== null && hovered.resumable) {
        const readyBy = hovered.videoReady ? null : at + timing.readyTimeoutMs;
        return { ...hovered, phase: "shown", exitUntil: null, resumable: false, readyBy };
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
    case "move":
      return state0.phase === "intent" ? { ...state0, stillSince: Math.max(state0.stillSince ?? at, at) } : state0;
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
    case "streamRetry":
      if (state0.phase !== "fetching" || state0.retryAt !== null) return state0;
      if (state0.retries >= timing.maxRetries) return leave(state0, at, "failed", { failure: "missing", timing });
      return { ...state0, retryAt: Math.max(at, event.retryAt), retries: state0.retries + 1 };
    case "videoReady": {
      // Retenue tant que la vidéo existe, fondu de sortie compris : un retour la trouvera prête.
      if (!VIDEO.has(state0.phase) && state0.exitUntil === null) return state0;
      const ready = { ...state0, videoReady: true, readyBy: null };
      if (state0.phase !== "buffering") return ready;
      return { ...ready, phase: at >= revealAt(state0, timing) ? "shown" : "ready" };
    }
    case "stillReady": {
      if (!VIDEO.has(state0.phase) || state0.stillReady) return state0;
      const still = { ...state0, stillReady: true };
      return revealable(still, at, timing) ? { ...still, phase: "shown" } : still;
    }
    case "videoFragment": {
      if (!VIDEO.has(state0.phase) || state0.videoFragment) return state0;
      const flowing = { ...state0, videoFragment: true };
      return revealable(flowing, at, timing) ? { ...flowing, phase: "shown" } : flowing;
    }
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
      const dropped = { ...state0, phase: "idle" as const, readyBy: null, retryAt: null, exitUntil: null, resumable: false, failure: null };
      return dropped.hovered && !dropped.blocked ? begin(dropped, at) : dropped;
    }
  }
}

/** Le réducteur du produit (temps de `TRAILER_PREVIEW_TIMING`), pour `useReducer`. */
export function trailerPreviewReducer(state: TrailerPreviewState, event: TrailerPreviewEvent): TrailerPreviewState {
  return reduceTrailerPreview(state, event);
}
