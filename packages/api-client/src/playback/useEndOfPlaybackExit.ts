/**
 * LA sortie de fin de lecture — décidée UNE fois, pour toutes les surfaces.
 *
 * À l'EOF, de deux choses l'une : l'affiche de fin est due et l'arbitre la
 * montre, ou PERSONNE n'a plus rien à dire — et il faut alors sortir du
 * lecteur. Rester sur une image figée était le cul-de-sac historique : les
 * gardes locales des lecteurs (`hasNextEpisode` seul)
 * supposaient l'affiche toujours due, un refus ou un réglage la supprimait,
 * et personne ne sortait.
 *
 * Chaque raison de ne pas la montrer — pas d'épisode suivant, réglage
 * `nextFinalCard` éteint, croix donnée sur l'affiche — déclenche le
 * MÊME rappel `onEndOfPlayback`, que chaque lecteur câble déjà vers sa
 * sortie : la fiche média (web), la fiche après la session plein écran
 * (bureau), `onFinished` (TV), le retour (mobile).
 */

import { useEffect, useRef } from "react";
import type { AutoNextState } from "@tentacle-tv/shared";
import type { PlaybackOverlayInput } from "./playbackOverlay.types";

export function useEndOfPlaybackExit(
  input: PlaybackOverlayInput,
  finalCardEnabled: boolean,
  nextState: AutoNextState,
): void {
  // Identité libre du rappel : l'effet ne doit pas rejouer parce qu'un parent
  // a re-rendu une lambda.
  const onEndRef = useRef(input.onEndOfPlayback);
  onEndRef.current = input.onEndOfPlayback;

  /** Une seule sortie par média — l'EOF rebat à chaque battement d'horloge. */
  const firedForItemRef = useRef<string | null>(null);

  const { itemId, playbackEnded, hasStarted, hasNextEpisode } = input;
  const { finalDismissed, chained } = nextState;

  useEffect(() => {
    if (!playbackEnded || !hasStarted) return;
    // La navigation vers l'épisode suivant est en vol : ne pas la concurrencer
    // d'une navigation vers la fiche — la course était perdue d'avance.
    if (chained) return;
    // L'affiche de fin est due : l'arbitre parle, le lecteur reste monté.
    if (hasNextEpisode && finalCardEnabled && !finalDismissed) return;
    const key = itemId ?? null;
    if (firedForItemRef.current === key) return;
    firedForItemRef.current = key;
    onEndRef.current();
  }, [
    playbackEnded,
    hasStarted,
    chained,
    hasNextEpisode,
    finalCardEnabled,
    finalDismissed,
    itemId,
  ]);
}
