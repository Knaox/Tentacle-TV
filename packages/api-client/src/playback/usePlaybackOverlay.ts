/**
 * LA coquille de lecture — une seule pour les six surfaces, sans DOM (React
 * Native compris). Elle bat la mesure, convertit secondes ⇄ millisecondes au
 * SEUL endroit du dépôt, pousse les deux réducteurs purs et projette le tout
 * par l'arbitre. Deux leçons héritées, tenues ici pour tout le monde : le
 * saut se joue HORS du réducteur, dans un rappel — jamais pendant un rendu
 * (le « Cannot update while rendering » corrigé côté TV, latent côté web) —
 * et `overlayRef` est un miroir SYNCHRONE : le bouton Retour TV le lit dans
 * le même dispatch d'événement, où un état React serait périmé.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AUTO_NEXT_IDLE,
  SKIP_DELAY_DEFAULT_MS,
  NEXT_COUNTDOWN_MS,
  INTRO_SKIP_IDLE,
  arbitrateOverlay,
  displayedCountdown,
  displayedNextCountdown,
  decideAutoNext,
  decideIntroSkip,
  findSkipCandidate,
  nextCardTriggerReached,
  type AutoNextInput,
  type AutoNextState,
  type IntroSkipState,
  type PlayerOverlay,
  type ResolvedSegment,
  type SegmentType,
  type SkipCandidate,
} from "@tentacle-tv/shared";
import { usePlaybackSettings } from "../hooks/usePlaybackSettings";

export interface PlaybackOverlayInput {
  itemId: string | undefined;
  isEpisode: boolean;
  hasNextEpisode: boolean;
  /** Position AFFICHÉE par le lecteur, offsets de flux déjà appliqués. */
  positionSeconds: number;
  durationSeconds: number;
  hasStarted: boolean;
  playbackEnded: boolean;
  segments: readonly ResolvedSegment[];
  /** Durée du contrat (ms) ; à défaut, `durationSeconds` fait foi. */
  runtimeMs?: number;
  serverAutoplayEnabled: boolean;
  /** TV : le décompte se suspend et rien ne s'affiche pendant le scrub. */
  scrubbing?: boolean;
  onSeekSeconds: (seconds: number) => void;
  onNextEpisode: () => void;
  onEndOfPlayback: () => void;
  /** Watch Together : annoncer un refus local au groupe. */
  onSegmentDismissNotify?: (type: SegmentType) => void;
  onNextDismissNotify?: () => void;
}

export interface PlaybackOverlayResult {
  overlay: PlayerOverlay;
  /** Miroir synchrone — pour le bouton Retour TV. */
  overlayRef: { readonly current: PlayerOverlay };
  /** Durées totales des glissières de décompte. */
  countdownTotals: { skipMs: number; nextMs: number };
  /** La croix de l'overlay courant (et l'annonce au groupe). */
  dismissOverlay: () => void;
  /** Saut manuel du bouton courant ; « lire maintenant » de la carte. */
  skipNow: () => void;
  playNow: () => void;
  /** Watch Together entrant : un membre a refusé. */
  signalRemoteSegmentDismiss: (type: SegmentType) => void;
  signalRemoteNextDismiss: () => void;
}

export function usePlaybackOverlay(input: PlaybackOverlayInput): PlaybackOverlayResult {
  const settings = usePlaybackSettings();

  const [skipState, setSkipState] = useState<IntroSkipState>(INTRO_SKIP_IDLE);
  const [nextState, setNextState] = useState<AutoNextState>(AUTO_NEXT_IDLE);

  // Miroirs synchrones : les rappels lisent le présent, pas le rendu d'avant.
  const inputRef = useRef(input);
  inputRef.current = input;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const skipStateRef = useRef(skipState);
  const nextStateRef = useRef(nextState);
  const previousVisibleRef = useRef(false);

  const commitSkipState = useCallback((state: IntroSkipState) => {
    skipStateRef.current = state;
    setSkipState(state);
  }, []);
  const commitNextState = useCallback((state: AutoNextState) => {
    nextStateRef.current = state;
    setNextState(state);
  }, []); // (l'identité stable des états inchangés évite tout re-rendu par battement)

  const positionMs = Math.round(input.positionSeconds * 1000);
  const runtimeMs =
    input.runtimeMs && input.runtimeMs > 0
      ? input.runtimeMs
      : Math.round(input.durationSeconds * 1000);

  const runAction = useCallback((candidate: SkipCandidate | null) => {
    if (!candidate) return;
    const p = inputRef.current;
    if (candidate.action.kind === "seek") p.onSeekSeconds(candidate.action.toMs / 1000);
    else if (candidate.action.kind === "nextEpisode") p.onNextEpisode();
    else p.onEndOfPlayback();
  }, []);

  const currentCandidate = useCallback((): SkipCandidate | null => {
    const p = inputRef.current;
    return findSkipCandidate({
      segments: p.segments,
      positionMs: Math.round(p.positionSeconds * 1000),
      hasStarted: p.hasStarted,
      isEpisode: p.isEpisode,
      hasNextEpisode: p.hasNextEpisode,
      settings: settingsRef.current,
    });
  }, []);

  const dispatchNext = useCallback(
    (nextInput: AutoNextInput) => {
      const p = inputRef.current;
      const [state, effect] = decideAutoNext(nextStateRef.current, nextInput, {
        hasNextEpisode: p.hasNextEpisode,
        serverEnabled: p.serverAutoplayEnabled,
        nextCountdown: settingsRef.current.next.nextCountdown,
        nextAutoPlay: settingsRef.current.next.nextAutoPlay,
      });
      commitNextState(state);
      if (effect === "nextEpisode") p.onNextEpisode();
    },
    [commitNextState],
  );

  /** Un battement : fait avancer les deux réducteurs, joue le saut à échéance. */
  const tick = useCallback(
    (elapsedMs: number) => {
      const p = inputRef.current;
      const candidate = currentCandidate();
      const visible = candidate !== null && !p.scrubbing;
      const active = visible && candidate !== null && candidate.settings.action === "auto";

      const [state, action] = decideIntroSkip(
        skipStateRef.current,
        {
          type: "frame",
          visible,
          active,
          elapsedMs,
          delayMs: candidate?.settings.autoDelayMs,
        },
        previousVisibleRef.current,
      );
      previousVisibleRef.current = visible;
      commitSkipState(state);
      if (action === "skip") runAction(candidate);

      const pRuntimeMs =
        p.runtimeMs && p.runtimeMs > 0 ? p.runtimeMs : Math.round(p.durationSeconds * 1000);
      dispatchNext({
        type: "frame",
        eligible:
          !p.scrubbing &&
          p.hasStarted &&
          nextCardTriggerReached(
            Math.round(p.positionSeconds * 1000),
            pRuntimeMs,
            p.segments,
            settingsRef.current.next,
          ),
        ended: p.playbackEnded,
        elapsedMs,
      });
    },
    [currentCandidate, dispatchNext, runAction, commitSkipState],
  );

  // Changement d'épisode : tout se réarme.
  useEffect(() => {
    if (!input.itemId) return;
    dispatchNext({ type: "item", itemId: input.itemId });
    commitSkipState(INTRO_SKIP_IDLE);
    previousVisibleRef.current = false;
  }, [input.itemId, dispatchNext, commitSkipState]);

  // Réévaluation immédiate à chaque changement d'entrée (sans consommer de temps).
  useEffect(() => {
    tick(0);
  }, [
    tick,
    positionMs,
    runtimeMs,
    input.hasStarted,
    input.playbackEnded,
    input.segments,
    input.hasNextEpisode,
    input.serverAutoplayEnabled,
    input.scrubbing,
    settings,
  ]);

  // L'horloge : fine (250 ms) pendant un décompte, lente (1 s) sinon.
  const countingDown = skipState.name === "countdown" || nextState.remainingMs !== null;
  useEffect(() => {
    const periodMs = countingDown ? 250 : 1000;
    let last = Date.now();
    const clock = setInterval(() => {
      const now = Date.now();
      tick(now - last);
      last = now;
    }, periodMs);
    return () => clearInterval(clock);
  }, [countingDown, tick]);

  const overlay = useMemo<PlayerOverlay>(() => {
    if (input.scrubbing) return { kind: "none" };
    const candidate = findSkipCandidate({
      segments: input.segments,
      positionMs,
      hasStarted: input.hasStarted,
      isEpisode: input.isEpisode,
      hasNextEpisode: input.hasNextEpisode,
      settings,
    });
    return arbitrateOverlay({
      positionMs,
      runtimeMs,
      hasStarted: input.hasStarted,
      playbackEnded: input.playbackEnded,
      segments: input.segments,
      isEpisode: input.isEpisode,
      hasNextEpisode: input.hasNextEpisode,
      settings,
      serverAutoplayEnabled: input.serverAutoplayEnabled,
      dismissed: {
        // « refusé » ET « saut demandé » masquent le bouton (la pilule ne se
        // remontre pas pendant que la position rattrape la cible).
        segments: candidate
          ? { [candidate.segment.type]: skipState.name === "dismissed" || skipState.name === "skipped" }
          : {},
        nextCard: nextState.dismissed || nextState.chained,
      },
      countdowns: { skip: displayedCountdown(skipState), next: displayedNextCountdown(nextState) },
    });
  }, [input, positionMs, runtimeMs, settings, skipState, nextState]);

  const overlayRef = useRef<PlayerOverlay>(overlay);
  overlayRef.current = overlay;

  const dismissOverlay = useCallback(() => {
    const current = overlayRef.current;
    if (current.kind === "skip") {
      commitSkipState(decideIntroSkip(skipStateRef.current, { type: "dismiss" }, true)[0]);
      inputRef.current.onSegmentDismissNotify?.(current.segmentType);
    } else if (current.kind === "nextCard") {
      dispatchNext({ type: "dismiss" });
      inputRef.current.onNextDismissNotify?.();
    }
  }, [dispatchNext, commitSkipState]);

  const skipNow = useCallback(() => {
    const candidate = currentCandidate();
    if (!candidate) return;
    commitSkipState(decideIntroSkip(skipStateRef.current, { type: "skipNow" }, true)[0]);
    runAction(candidate);
  }, [currentCandidate, runAction, commitSkipState]);

  const playNow = useCallback(() => {
    dispatchNext({ type: "playNow" });
  }, [dispatchNext]);

  const signalRemoteSegmentDismiss = useCallback(
    (type: SegmentType) => {
      const candidate = currentCandidate();
      if (candidate?.segment.type !== type) return;
      commitSkipState(decideIntroSkip(skipStateRef.current, { type: "dismiss" }, true)[0]);
    },
    [currentCandidate, commitSkipState],
  );

  const signalRemoteNextDismiss = useCallback(() => {
    dispatchNext({ type: "dismiss" });
  }, [dispatchNext]);

  const skipMs = currentCandidate()?.settings.autoDelayMs ?? SKIP_DELAY_DEFAULT_MS;
  return {
    overlay,
    overlayRef,
    countdownTotals: { skipMs, nextMs: NEXT_COUNTDOWN_MS },
    dismissOverlay,
    skipNow,
    playNow,
    signalRemoteSegmentDismiss,
    signalRemoteNextDismiss,
  };
}
