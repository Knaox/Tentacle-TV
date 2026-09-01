/**
 * LA coquille de lecture — une seule pour les six surfaces, sans DOM (React
 * Native compris). Elle bat la mesure, convertit secondes ⇄ millisecondes au
 * SEUL endroit du dépôt, pousse les deux réducteurs purs et projette le tout
 * par l'arbitre. Deux leçons héritées, tenues ici pour tout le monde : le
 * saut se joue HORS du réducteur, dans un rappel — jamais pendant un rendu
 * (le « Cannot update while rendering » corrigé côté TV, latent côté web) —
 * et `overlayRef` est un miroir SYNCHRONE : le bouton Retour TV le lit dans
 * le même dispatch d'événement, où un état React serait périmé.
 *
 * Les REFUS — la croix (`useMutedSegments.ts`) et la scène post-générique
 * revendiquée (`usePostCreditsClaim.ts`) — font taire la carte « à suivre » ET
 * son minuteur, par le sélecteur PARTAGÉ `autoNextEligible` : TOUT candidat de
 * saut y ferme l'enchaînement (affiché, il occupe la surface ; en sourdine, il
 * vaut refus — la croix ne supprime pas le candidat), et la revendication tient
 * jusque dans le générique final, où il n'y a plus de bouton. Le RETOUR EN
 * ARRIÈRE lève ces gestes-là, saut compris — qui revient derrière l'endroit
 * d'un geste le redemande. Les refus de la SUITE (carte, affiche de fin), eux,
 * tiennent jusqu'au changement d'épisode : ils vivent dans `useAutoNextDispatch`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SKIP_DELAY_DEFAULT_MS, NEXT_COUNTDOWN_MS, INTRO_SKIP_IDLE,
  arbitrateOverlay, autoNextEligible, displayedCountdown, displayedNextCountdown,
  decideIntroSkip, findSkipCandidate, hasRewoundPastSkip,
  isSegmentSilenced,
  type IntroSkipState,
  type PlayerOverlay, type SegmentType, type SkipCandidate, type SkipCandidateInput,
} from "@tentacle-tv/shared";
import { usePlaybackSettings } from "../hooks/usePlaybackSettings";
import { useAutoNextDispatch } from "./useAutoNextDispatch";
import { useEndOfPlaybackExit } from "./useEndOfPlaybackExit";
import { useMutedSegments } from "./useMutedSegments";
import { usePostCreditsClaim } from "./usePostCreditsClaim";
import type { PlaybackOverlayInput, PlaybackOverlayResult } from "./playbackOverlay.types";

export type { PlaybackOverlayInput, PlaybackOverlayResult } from "./playbackOverlay.types";

export function usePlaybackOverlay(input: PlaybackOverlayInput): PlaybackOverlayResult {
  const settings = usePlaybackSettings();

  const [skipState, setSkipState] = useState<IntroSkipState>(INTRO_SKIP_IDLE);
  const { muted, mutedRef, mute, releaseRewound } = useMutedSegments(input.itemId);
  const postCredits = usePostCreditsClaim(input.itemId);
  const { claim: claimPostCredits, releaseIfBehind: releasePostCredits, claimedRef: postCreditsClaimedRef } = postCredits;

  // Miroirs synchrones : les rappels lisent le présent, pas le rendu d'avant.
  const inputRef = useRef(input);
  inputRef.current = input;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const skipStateRef = useRef(skipState);
  const previousVisibleRef = useRef(false);
  /** Position visée par le dernier saut — repasser derrière elle réarme. */
  const skipTargetMsRef = useRef<number | null>(null);

  // L'enchaînement d'épisode vit dans son propre bloc — état, gestes, refus.
  const { nextState, dispatchNext, playNow, dismissNext, cancelNextCountdown, signalRemoteNextDismiss } =
    useAutoNextDispatch(inputRef, settingsRef);

  // Quand l'affiche de fin n'est pas due à l'EOF, la sortie du lecteur part
  // d'ici — plus d'image figée, quelle que soit la raison du silence.
  useEndOfPlaybackExit(input, settings.next.nextFinalCard, nextState);

  const commitSkipState = useCallback((state: IntroSkipState) => {
    skipStateRef.current = state;
    setSkipState(state);
  }, []);

  const positionMs = Math.round(input.positionSeconds * 1000);
  const runtimeMs =
    input.runtimeMs && input.runtimeMs > 0
      ? input.runtimeMs
      : Math.round(input.durationSeconds * 1000);

  const runAction = useCallback((candidate: SkipCandidate | null) => {
    if (!candidate) return;
    const p = inputRef.current;
    // Rejoindre la scène, c'est demander à la VOIR : la carte se taira jusqu'à
    // ce qu'on rembobine avant le générique, ou qu'on change d'épisode.
    if (candidate.labelKey === "skipToPostCredits") claimPostCredits(candidate.segment.startMs);
    if (candidate.action.kind === "seek") p.onSeekSeconds(candidate.action.toMs / 1000);
    else if (candidate.action.kind === "nextEpisode") p.onNextEpisode();
    else p.onEndOfPlayback();
  }, [claimPostCredits]);

  /** La même forme d'entrée pour le candidat ET l'éligibilité — décrite une fois. */
  const frameInput = useCallback((): SkipCandidateInput => {
    const p = inputRef.current;
    return {
      segments: p.segments,
      positionMs: Math.round(p.positionSeconds * 1000),
      hasStarted: p.hasStarted,
      isEpisode: p.isEpisode,
      hasNextEpisode: p.hasNextEpisode,
      settings: settingsRef.current,
    };
  }, []);

  const currentCandidate = useCallback(
    (): SkipCandidate | null => findSkipCandidate(frameInput()),
    [frameInput],
  );

  /** Un battement : fait avancer les deux réducteurs, joue le saut à échéance. */
  const tick = useCallback(
    (elapsedMs: number) => {
      const p = inputRef.current;
      const nowMs = Math.round(p.positionSeconds * 1000);
      const candidate = currentCandidate();
      const visible = candidate !== null && !p.scrubbing;
      // Un passage mis en sourdine ne compte plus : la croix a aussi coupé ça.
      const silenced = candidate !== null && mutedRef.current.has(candidate.segment.type);
      const active = visible && !silenced && candidate !== null && candidate.settings.action === "auto";

      // Les trois refus que le RETOUR EN ARRIÈRE lève : la scène revendiquée,
      // les passages refusés, et le saut qu'on attendait encore.
      releasePostCredits(nowMs);
      releaseRewound(nowMs);
      if (hasRewoundPastSkip(nowMs, skipTargetMsRef.current)) {
        skipTargetMsRef.current = null;
        if (skipStateRef.current.name === "skipped") commitSkipState(INTRO_SKIP_IDLE);
      }

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

      const pRuntimeMs = p.runtimeMs && p.runtimeMs > 0 ? p.runtimeMs : Math.round(p.durationSeconds * 1000);
      dispatchNext({
        type: "frame",
        // LE MÊME sélecteur que l'arbitre, candidat de saut compris : le
        // minuteur ne connaît ni position ni segments, et s'il ne dit pas la
        // même chose que la carte, l'épisode part sans qu'aucune surface l'ait
        // annoncé. La sourdine n'a plus à être transmise — le candidat ferme
        // l'éligibilité qu'il soit affiché ou mis en sourdine.
        eligible:
          !p.scrubbing &&
          p.hasStarted &&
          autoNextEligible({
            ...frameInput(),
            runtimeMs: pRuntimeMs,
            libraryId: p.libraryId ?? null,
            postCreditsClaimed: postCreditsClaimedRef.current,
          }),
        ended: p.playbackEnded,
        elapsedMs,
        // Ce qu'il reste de média : le moteur ne le lit qu'à l'armement, pour
        // que le décompte expire AVANT la fin. Une fiche qui paraît quatre
        // secondes avant le bout n'en décompte pas dix.
        remainingMediaMs: Math.max(0, pRuntimeMs - nowMs),
      });
    },
    [currentCandidate, frameInput, dispatchNext, runAction, commitSkipState, releasePostCredits, releaseRewound, mutedRef, postCreditsClaimedRef],
  );

  // Changement d'épisode : tout se réarme.
  useEffect(() => {
    if (!input.itemId) return;
    dispatchNext({ type: "item", itemId: input.itemId });
    commitSkipState(INTRO_SKIP_IDLE);
    previousVisibleRef.current = false;
    skipTargetMsRef.current = null;
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
    const candidate = findSkipCandidate(frameInput());
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
      mutedSegments: muted,
      libraryId: input.libraryId ?? null,
      controlsVisible: input.controlsVisible,
      postCreditsClaimed: postCredits.claimed,
      dismissed: {
        // Trois raisons de ne pas montrer la pilule, et une seule d'insister :
        // le saut demandé (la position rattrape la cible), le refus du passage
        // en cours, et la SOURDINE — qui, elle, ne cède que le temps où les
        // contrôles du lecteur sont à l'écran.
        segments: candidate
          ? {
              [candidate.segment.type]:
                isSegmentSilenced(muted, candidate.segment.type, input.controlsVisible) ||
                (!muted.has(candidate.segment.type) &&
                  (skipState.name === "dismissed" || skipState.name === "skipped")),
            }
          : {},
        nextCard: nextState.dismissed || nextState.chained,
        // `chained` musèle aussi l'affiche : la navigation est en vol, rien
        // ne doit plus paraître le temps qu'elle aboutisse.
        finalCard: nextState.finalDismissed || nextState.chained,
      },
      countdowns: { skip: displayedCountdown(skipState), next: displayedNextCountdown(nextState) },
    });
  }, [input, positionMs, runtimeMs, settings, skipState, nextState, muted, postCredits.claimed, frameInput]);

  const overlayRef = useRef<PlayerOverlay>(overlay);
  overlayRef.current = overlay;

  const dismissOverlay = useCallback(() => {
    const current = overlayRef.current;
    if (current.kind === "skip") {
      commitSkipState(decideIntroSkip(skipStateRef.current, { type: "dismiss" }, true)[0]);
      mute(current.segmentType, Math.round(inputRef.current.positionSeconds * 1000));
      inputRef.current.onSegmentDismissNotify?.(current.segmentType);
    } else if (current.kind === "nextCard" || current.kind === "nextButton") {
      // Chaque surface porte SON refus : la croix de l'affiche de fin n'éteint
      // pas la carte, et écarter la carte laisse l'affiche paraître à l'EOF.
      dismissNext(current.kind === "nextCard" && current.final);
    }
  }, [dismissNext, commitSkipState, mute]);

  const skipNow = useCallback(() => {
    const candidate = currentCandidate();
    if (!candidate) return;
    commitSkipState(decideIntroSkip(skipStateRef.current, { type: "skipNow" }, true)[0]);
    skipTargetMsRef.current = candidate.action.kind === "seek" ? candidate.action.toMs : null;
    runAction(candidate);
  }, [currentCandidate, runAction, commitSkipState]);

  const signalRemoteSegmentDismiss = useCallback(
    (type: SegmentType) => {
      // Le refus d'un membre vaut pour le groupe, et pour toute la lecture —
      // même s'il porte sur un passage que NOTRE position n'a pas atteint.
      mute(type, Math.round(inputRef.current.positionSeconds * 1000));
      const candidate = currentCandidate();
      if (candidate?.segment.type !== type) return;
      commitSkipState(decideIntroSkip(skipStateRef.current, { type: "dismiss" }, true)[0]);
    },
    [currentCandidate, commitSkipState, mute],
  );

  const skipMs = currentCandidate()?.settings.autoDelayMs ?? SKIP_DELAY_DEFAULT_MS;
  // La durée dont le minuteur est PARTI, pas celle qu'on a réglée : le moteur
  // la raccourcit quand la fin approche, et la barre de progression doit
  // mesurer ce qui court réellement.
  const nextMs = nextState.armedMs ?? settingsRef.current.next.nextCountdownMs ?? NEXT_COUNTDOWN_MS;
  return {
    overlay,
    overlayRef,
    countdownTotals: { skipMs, nextMs },
    dismissOverlay,
    mutedSegments: muted,
    skipNow,
    playNow,
    cancelNextCountdown,
    signalRemoteSegmentDismiss,
    signalRemoteNextDismiss,
  };
}
