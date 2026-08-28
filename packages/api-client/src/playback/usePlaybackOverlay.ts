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
  AUTO_NEXT_REPOS,
  DELAI_SAUT_DEFAUT_MS,
  NEXT_COUNTDOWN_MS,
  REPOS,
  arbitrateOverlay,
  compteAffiche,
  compteAfficheEnchainement,
  decideAutoNext,
  deciderSautIntro,
  findSkipCandidate,
  nextCardTriggerReached,
  type AutoNextEntree,
  type AutoNextState,
  type EtatSautIntro,
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
  const reglages = usePlaybackSettings();

  const [etatSaut, setEtatSaut] = useState<EtatSautIntro>(REPOS);
  const [etatSuite, setEtatSuite] = useState<AutoNextState>(AUTO_NEXT_REPOS);

  // Miroirs synchrones : les rappels lisent le présent, pas le rendu d'avant.
  const entreeRef = useRef(input);
  entreeRef.current = input;
  const reglagesRef = useRef(reglages);
  reglagesRef.current = reglages;
  const etatSautRef = useRef(etatSaut);
  const etatSuiteRef = useRef(etatSuite);
  const visiblePrecedentRef = useRef(false);

  const poserEtatSaut = useCallback((etat: EtatSautIntro) => {
    etatSautRef.current = etat;
    setEtatSaut(etat);
  }, []);
  const poserEtatSuite = useCallback((etat: AutoNextState) => {
    etatSuiteRef.current = etat;
    setEtatSuite(etat);
  }, []); // (l'identité stable des états inchangés évite tout re-rendu par battement)

  const positionMs = Math.round(input.positionSeconds * 1000);
  const runtimeMs =
    input.runtimeMs && input.runtimeMs > 0
      ? input.runtimeMs
      : Math.round(input.durationSeconds * 1000);

  const executerAction = useCallback((candidat: SkipCandidate | null) => {
    if (!candidat) return;
    const p = entreeRef.current;
    if (candidat.action.kind === "seek") p.onSeekSeconds(candidat.action.toMs / 1000);
    else if (candidat.action.kind === "nextEpisode") p.onNextEpisode();
    else p.onEndOfPlayback();
  }, []);

  const candidatCourant = useCallback((): SkipCandidate | null => {
    const p = entreeRef.current;
    return findSkipCandidate({
      segments: p.segments,
      positionMs: Math.round(p.positionSeconds * 1000),
      hasStarted: p.hasStarted,
      isEpisode: p.isEpisode,
      hasNextEpisode: p.hasNextEpisode,
      settings: reglagesRef.current,
    });
  }, []);

  const dispatchSuite = useCallback(
    (entree: AutoNextEntree) => {
      const p = entreeRef.current;
      const [etat, effet] = decideAutoNext(etatSuiteRef.current, entree, {
        hasNextEpisode: p.hasNextEpisode,
        serverEnabled: p.serverAutoplayEnabled,
        nextCountdown: reglagesRef.current.next.nextCountdown,
        nextAutoPlay: reglagesRef.current.next.nextAutoPlay,
      });
      poserEtatSuite(etat);
      if (effet === "epsSuivant") p.onNextEpisode();
    },
    [poserEtatSuite],
  );

  /** Un battement : fait avancer les deux réducteurs, joue le saut à échéance. */
  const battre = useCallback(
    (ecouleMs: number) => {
      const p = entreeRef.current;
      const candidat = candidatCourant();
      const visible = candidat !== null && !p.scrubbing;
      const actif = visible && candidat !== null && candidat.reglage.action === "auto";

      const [etat, action] = deciderSautIntro(
        etatSautRef.current,
        {
          type: "cadre",
          visible,
          actif,
          ecouleMs,
          delaiMs: candidat?.reglage.autoDelayMs,
        },
        visiblePrecedentRef.current,
      );
      visiblePrecedentRef.current = visible;
      poserEtatSaut(etat);
      if (action === "sauter") executerAction(candidat);

      const pRuntimeMs =
        p.runtimeMs && p.runtimeMs > 0 ? p.runtimeMs : Math.round(p.durationSeconds * 1000);
      dispatchSuite({
        type: "cadre",
        eligible:
          !p.scrubbing &&
          p.hasStarted &&
          nextCardTriggerReached(
            Math.round(p.positionSeconds * 1000),
            pRuntimeMs,
            p.segments,
            reglagesRef.current.next,
          ),
        termine: p.playbackEnded,
        ecouleMs,
      });
    },
    [candidatCourant, dispatchSuite, executerAction, poserEtatSaut],
  );

  // Changement d'épisode : tout se réarme.
  useEffect(() => {
    if (!input.itemId) return;
    dispatchSuite({ type: "item", itemId: input.itemId });
    poserEtatSaut(REPOS);
    visiblePrecedentRef.current = false;
  }, [input.itemId, dispatchSuite, poserEtatSaut]);

  // Réévaluation immédiate à chaque changement d'entrée (sans consommer de temps).
  useEffect(() => {
    battre(0);
  }, [
    battre,
    positionMs,
    runtimeMs,
    input.hasStarted,
    input.playbackEnded,
    input.segments,
    input.hasNextEpisode,
    input.serverAutoplayEnabled,
    input.scrubbing,
    reglages,
  ]);

  // L'horloge : fine (250 ms) pendant un décompte, lente (1 s) sinon.
  const decompteEnCours = etatSaut.nom === "decompte" || etatSuite.resteMs !== null;
  useEffect(() => {
    const periode = decompteEnCours ? 250 : 1000;
    let dernier = Date.now();
    const horloge = setInterval(() => {
      const maintenant = Date.now();
      battre(maintenant - dernier);
      dernier = maintenant;
    }, periode);
    return () => clearInterval(horloge);
  }, [decompteEnCours, battre]);

  const overlay = useMemo<PlayerOverlay>(() => {
    if (input.scrubbing) return { kind: "none" };
    const candidat = findSkipCandidate({
      segments: input.segments,
      positionMs,
      hasStarted: input.hasStarted,
      isEpisode: input.isEpisode,
      hasNextEpisode: input.hasNextEpisode,
      settings: reglages,
    });
    return arbitrateOverlay({
      positionMs,
      runtimeMs,
      hasStarted: input.hasStarted,
      playbackEnded: input.playbackEnded,
      segments: input.segments,
      isEpisode: input.isEpisode,
      hasNextEpisode: input.hasNextEpisode,
      settings: reglages,
      serverAutoplayEnabled: input.serverAutoplayEnabled,
      dismissed: {
        // « refusé » ET « saut demandé » masquent le bouton (la pilule ne se
        // remontre pas pendant que la position rattrape la cible).
        segments: candidat
          ? { [candidat.segment.type]: etatSaut.nom === "refuse" || etatSaut.nom === "saute" }
          : {},
        nextCard: etatSuite.refuse || etatSuite.enchaine,
      },
      countdowns: { skip: compteAffiche(etatSaut), next: compteAfficheEnchainement(etatSuite) },
    });
  }, [input, positionMs, runtimeMs, reglages, etatSaut, etatSuite]);

  const overlayRef = useRef<PlayerOverlay>(overlay);
  overlayRef.current = overlay;

  const dismissOverlay = useCallback(() => {
    const courant = overlayRef.current;
    if (courant.kind === "skip") {
      poserEtatSaut(deciderSautIntro(etatSautRef.current, { type: "croix" }, true)[0]);
      entreeRef.current.onSegmentDismissNotify?.(courant.segmentType);
    } else if (courant.kind === "nextCard") {
      dispatchSuite({ type: "refus" });
      entreeRef.current.onNextDismissNotify?.();
    }
  }, [dispatchSuite, poserEtatSaut]);

  const skipNow = useCallback(() => {
    const candidat = candidatCourant();
    if (!candidat) return;
    poserEtatSaut(deciderSautIntro(etatSautRef.current, { type: "sauteMaintenant" }, true)[0]);
    executerAction(candidat);
  }, [candidatCourant, executerAction, poserEtatSaut]);

  const playNow = useCallback(() => {
    dispatchSuite({ type: "lireMaintenant" });
  }, [dispatchSuite]);

  const signalRemoteSegmentDismiss = useCallback(
    (type: SegmentType) => {
      const candidat = candidatCourant();
      if (candidat?.segment.type !== type) return;
      poserEtatSaut(deciderSautIntro(etatSautRef.current, { type: "croix" }, true)[0]);
    },
    [candidatCourant, poserEtatSaut],
  );

  const signalRemoteNextDismiss = useCallback(() => {
    dispatchSuite({ type: "refus" });
  }, [dispatchSuite]);

  const skipMs = candidatCourant()?.reglage.autoDelayMs ?? DELAI_SAUT_DEFAUT_MS;
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
