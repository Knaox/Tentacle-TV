/**
 * Quand l'activité en direct doit-elle être redessinée ? Une décision pure,
 * pour que la Live Activity d'iOS et la notification d'Android suivent la
 * MÊME cadence — et qu'elle se teste.
 *
 * Tout de suite : un changement de phase (une attente se DIT dès qu'elle
 * commence), du nombre de titres, ou une fin estimée qui bouge franchement.
 * Pour la barre seule : un pas de 5 %, au plus toutes les 10 s.
 */

import { nextLiveEstimate, shouldPublishEstimate, type LiveEstimate } from "./liveEstimate";
import type { LiveTransferPhase, LiveTransferView } from "./liveTransfer";

/** Ce qui est affiché, tel quel. */
export interface LiveContent {
  phase: LiveTransferPhase;
  remaining: number;
  total: number;
  /** Pour-cent entier, `null` sans taille connue. */
  percent: number | null;
  /** Fin estimée à afficher (epoch ms) — seulement en `transferring`. */
  endsAtMs: number | null;
  /** Le titre restant s'il n'y en a qu'un. */
  single: LiveTransferView["single"];
  seriesName: string | null;
}

export interface LivePublishState {
  estimate: LiveEstimate | null;
  shown: LiveContent | null;
  shownAtMs: number;
}

export type LivePublishAction =
  | { kind: "none" }
  | { kind: "start"; content: LiveContent }
  | { kind: "update"; content: LiveContent }
  | { kind: "end" };

export const LIVE_PERCENT_STEP = 5;
export const LIVE_PROGRESS_MIN_INTERVAL_MS = 10_000;

export const INITIAL_LIVE_STATE: LivePublishState = { estimate: null, shown: null, shownAtMs: 0 };

function percentOf(fraction: number | null): number | null {
  return fraction === null ? null : Math.max(0, Math.min(100, Math.floor(fraction * 100)));
}

function structuralChange(a: LiveContent, b: LiveContent): boolean {
  return (
    a.phase !== b.phase ||
    a.remaining !== b.remaining ||
    a.total !== b.total ||
    a.single?.itemId !== b.single?.itemId ||
    a.seriesName !== b.seriesName
  );
}

/**
 * `force` : redessiner l'état du moment même sans changement notable — au
 * passage en arrière-plan (le JavaScript va être suspendu) ou pour retenter un
 * démarrage refusé (`liveSurfaceRepair.ts`).
 */
export function nextLivePublish(
  state: LivePublishState,
  view: LiveTransferView | null,
  nowMs: number,
  options: { force?: boolean } = {},
): { state: LivePublishState; action: LivePublishAction } {
  if (view === null) {
    const action: LivePublishAction = state.shown === null ? { kind: "none" } : { kind: "end" };
    return { state: INITIAL_LIVE_STATE, action };
  }

  const estimate = view.phase === "transferring" ? nextLiveEstimate(state.estimate, view.rawEtaMs, nowMs) : null;
  const shown = state.shown;
  const candidate: LiveContent = {
    phase: view.phase,
    remaining: view.remaining,
    total: view.total,
    percent: percentOf(view.fraction),
    endsAtMs: estimate === null ? null : Math.round(estimate.endsAtMs),
    single: view.single,
    seriesName: view.seriesName,
  };

  if (shown === null) {
    return { state: { estimate, shown: candidate, shownAtMs: nowMs }, action: { kind: "start", content: candidate } };
  }

  const estimateMoved = shouldPublishEstimate(shown.endsAtMs, candidate.endsAtMs, nowMs);
  const percentMoved =
    shown.percent !== candidate.percent &&
    (shown.percent === null ||
      candidate.percent === null ||
      Math.abs(candidate.percent - shown.percent) >= LIVE_PERCENT_STEP) &&
    nowMs - state.shownAtMs >= LIVE_PROGRESS_MIN_INTERVAL_MS;

  if (options.force === true || structuralChange(shown, candidate) || estimateMoved || percentMoved) {
    return { state: { estimate, shown: candidate, shownAtMs: nowMs }, action: { kind: "update", content: candidate } };
  }
  // Rien d'assez neuf : la fin affichée reste celle qu'on garde comme référence.
  return { state: { estimate, shown, shownAtMs: state.shownAtMs }, action: { kind: "none" } };
}
