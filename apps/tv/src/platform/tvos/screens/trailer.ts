import { useCallback, useEffect, useRef, useState } from "react";
import {
  TRAILER_CHROME_ON_IDLE,
  TRAILER_CLOSE_KEY,
  TRAILER_IDLE_MS,
  trailerChromeOnPlaying,
  trailerChromeOnWake,
  trailerLeavesAfter,
  trailerWakes,
  type TrailerChromeStep,
  type TrailerState,
} from "@tentacle-tv/tv-core";
import type { FocusBinding } from "../../../redesign/focus/focusBinding";
import { useRemoteIntents } from "../input";

/**
 * L'applicateur tvOS de la BANDE-ANNONCE — les décisions sont celles de
 * tv-core (`player/trailerChrome.ts`, relevé BA-1 à BA-3) ; ce module ne fait
 * que les poser : la préférence de focus de la croix, l'attente de
 * l'estompage du chrome, le réveil par la télécommande (l'entrée unique),
 * le retour à la fiche quand la bande-annonce est indisponible.
 */

const ENTRY: FocusBinding = { native: { hasTVPreferredFocus: true } };

/** Le port du focus de l'écran : la croix, seule cible, porte l'entrée. */
export const bindTrailerFocus = (focusKey: string): FocusBinding | undefined => (focusKey === TRAILER_CLOSE_KEY ? ENTRY : undefined);

/**
 * Le chrome d'une lecture plein écran : allumé, estompé après l'attente sans
 * geste, rallumé par le moindre geste de la télécommande (Retour excepté).
 * Rend `dimmed`.
 */
export function useTrailerChrome(playing: boolean, enabled: boolean): boolean {
  const [dimmed, setDimmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playingRef = useRef(playing);
  playingRef.current = playing;

  const run = useCallback((step: TrailerChromeStep) => {
    setDimmed(step.dimmed);
    if (step.timer === "keep") return;
    if (timer.current) clearTimeout(timer.current);
    if (step.timer === "arm") timer.current = setTimeout(() => run(TRAILER_CHROME_ON_IDLE), TRAILER_IDLE_MS);
  }, []);

  useEffect(() => {
    run(trailerChromeOnPlaying(playing));
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [playing, run]);

  useRemoteIntents((event) => {
    if (trailerWakes(event.intent)) run(trailerChromeOnWake(playingRef.current));
  }, enabled);
  return dimmed;
}

/** « Indisponible » : la fiche revient d'elle-même, le temps de lire la phrase. */
export function useTrailerReturn(state: TrailerState, screenFocused: boolean, close: () => void): void {
  useEffect(() => {
    const delay = trailerLeavesAfter(state, screenFocused);
    if (delay === null) return undefined;
    const timer = setTimeout(close, delay);
    return () => clearTimeout(timer);
  }, [state, screenFocused, close]);
}
