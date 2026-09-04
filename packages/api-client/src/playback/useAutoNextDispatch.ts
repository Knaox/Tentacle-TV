/**
 * Le bloc « enchaînement d'épisode » de la coquille de lecture : l'état du
 * moteur (`autoNextEngine`), et les gestes qui le poussent.
 *
 * Extrait de `usePlaybackOverlay` pour tenir chaque fichier sous ses trois
 * cents lignes — la frontière est celle du réducteur : tout ce qui écrit
 * `AutoNextState` vit ici, la coquille ne fait plus que le projeter.
 *
 * Deux refus, un par surface — c'est le cœur du découplage : `dismissNext`
 * traduit la croix en refus de la carte/pilule OU de l'affiche de fin selon
 * la surface qui la portait, et prévient le groupe Watch Together dans les
 * deux cas. Le refus distant, lui, ne vise jamais l'affiche : un membre qui
 * dit non annule le décompte de la salle, il ne ferme pas l'écran des autres.
 */

import { useCallback, useRef, useState, type MutableRefObject } from "react";
import {
  AUTO_NEXT_IDLE,
  decideAutoNext,
  type AutoNextInput,
  type AutoNextState,
  type PlaybackSettings,
} from "@tentacle-tv/shared";
import type { PlaybackOverlayInput } from "./playbackOverlay.types";

export interface AutoNextDispatch {
  nextState: AutoNextState;
  /** Miroir SYNCHRONE — les rappels lisent le présent, pas le rendu d'avant. */
  nextStateRef: MutableRefObject<AutoNextState>;
  dispatchNext: (input: AutoNextInput) => void;
  playNow: () => void;
  /** La croix d'une surface « suite » — `final` = celle de l'affiche de fin. */
  dismissNext: (final: boolean) => void;
  /** Tue le minuteur pour l'épisode, la surface reste une PROPOSITION — noter
   *  depuis l'affiche de fin dit « je suis encore sur cet écran ». */
  cancelNextCountdown: () => void;
  signalRemoteNextDismiss: () => void;
}

export function useAutoNextDispatch(
  inputRef: MutableRefObject<PlaybackOverlayInput>,
  settingsRef: MutableRefObject<PlaybackSettings>,
): AutoNextDispatch {
  const [nextState, setNextState] = useState<AutoNextState>(AUTO_NEXT_IDLE);
  const nextStateRef = useRef(nextState);

  const commitNextState = useCallback((state: AutoNextState) => {
    nextStateRef.current = state;
    setNextState(state);
  }, []); // (l'identité stable des états inchangés évite tout re-rendu par battement)

  const dispatchNext = useCallback(
    (nextInput: AutoNextInput) => {
      const p = inputRef.current;
      const [state, effect] = decideAutoNext(nextStateRef.current, nextInput, {
        hasNextEpisode: p.hasNextEpisode,
        nextCountdown: settingsRef.current.next.nextCountdown,
        nextAutoPlay: settingsRef.current.next.nextAutoPlay,
        nextCountdownMs: settingsRef.current.next.nextCountdownMs,
      });
      commitNextState(state);
      if (effect === "nextEpisode") p.onNextEpisode();
    },
    [commitNextState, inputRef, settingsRef],
  );

  const playNow = useCallback(() => {
    dispatchNext({ type: "playNow" });
  }, [dispatchNext]);

  const dismissNext = useCallback(
    (final: boolean) => {
      // Chaque surface porte SON refus : écarter la carte du générique laisse
      // l'affiche de fin paraître à l'EOF, avec un décompte neuf.
      dispatchNext(final ? { type: "dismissFinal" } : { type: "dismiss" });
      // En séance, refuser la carte annule aussi le décompte de l'épisode —
      // sinon le refuseur ré-armerait seul à l'EOF et son enchaînement
      // (`wt:setItem`) embarquerait la salle qu'il venait de refuser.
      if (!final && inputRef.current.groupSession === true) {
        dispatchNext({ type: "cancelCountdown" });
      }
      inputRef.current.onNextDismissNotify?.();
    },
    [dispatchNext, inputRef],
  );

  const cancelNextCountdown = useCallback(() => {
    dispatchNext({ type: "cancelCountdown" });
  }, [dispatchNext]);

  const signalRemoteNextDismiss = useCallback(() => {
    // Un membre a dit non : sa croix masque NOTRE carte et annule le décompte
    // pour l'épisode — mais l'affiche de fin restera une PROPOSITION chez
    // nous. Refuser une vignette n'a jamais fermé l'écran des autres.
    dispatchNext({ type: "dismiss" });
    dispatchNext({ type: "cancelCountdown" });
  }, [dispatchNext]);

  return {
    nextState,
    nextStateRef,
    dispatchNext,
    playNow,
    dismissNext,
    cancelNextCountdown,
    signalRemoteNextDismiss,
  };
}
