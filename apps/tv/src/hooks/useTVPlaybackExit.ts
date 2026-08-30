import { useCallback } from "react";
import type { TVPlaybackOverlay } from "./useTVPlaybackOverlay";

/**
 * La croix de l'affiche de fin, côté TV — et le routage du Retour qui va avec.
 *
 * QUAND sortir n'est plus décidé ici : la coquille partagée
 * (`useEndOfPlaybackExit`) appelle `onFinished` dès que l'affiche n'est plus
 * due à l'EOF — croix donnée, réglage éteint, fin sans suite. Le départ passe
 * par un effet React, donc APRÈS le commit du rendu : `usePreventRemove` ne
 * bloque plus le dispatch du même tick, l'ancien `setTimeout` n'a plus
 * d'objet. Ne reste que la traduction du geste : la croix sur l'affiche de
 * fin doit dire au routeur Retour qu'elle a consommé l'appui.
 */
export function useTVPlaybackExit(args: {
  playback: TVPlaybackOverlay;
  endedRef: React.MutableRefObject<boolean>;
}): { dismissAutoPlay: () => boolean } {
  const { playback, endedRef } = args;
  const { overlayRef, dismissOverlay } = playback;

  const dismissAutoPlay = useCallback((): boolean => {
    const currentOverlay = overlayRef.current;
    const wasFinal = currentOverlay.kind === "nextCard" && currentOverlay.final;
    dismissOverlay();
    // La sortie elle-même part de la coquille (refus → plus d'affiche due).
    return wasFinal && endedRef.current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dismissOverlay, overlayRef]);

  return { dismissAutoPlay };
}
