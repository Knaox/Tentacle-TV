import { useCallback, useEffect } from "react";
import type { TVPlaybackOverlay } from "./useTVPlaybackOverlay";

/**
 * Sortir du lecteur quand il n'y a plus rien à regarder.
 *
 * Deux chemins, et ils ne se confondent pas :
 *
 * - la CROIX de l'affiche de fin. Écarter la carte du générique laisse le
 *   contenu jouer ; écarter l'affiche de FIN ne laisse rien — sans ce retour
 *   à la fiche, le lecteur restait gelé sur sa dernière image. Le départ est
 *   différé d'un tick : `usePreventRemove` bloque un dispatch du même tick,
 *   la valeur de prévention venant du dernier rendu ;
 * - la fin ATTEINTE sans rien à proposer (film, dernier épisode, auto-play
 *   coupé côté serveur). La règle ne demande rien à l'arbitre — il n'a par
 *   définition monté aucune surface — et c'est la même que sur le web.
 */
export function useTVPlaybackExit(args: {
  ended: boolean;
  playback: TVPlaybackOverlay;
  endedRef: React.MutableRefObject<boolean>;
  handleFinished: () => void;
}): { dismissAutoPlay: () => boolean } {
  const { ended, playback, endedRef, handleFinished } = args;
  const { overlayRef, dismissOverlay, autoPlay, autoplayEnabled } = playback;
  const nextEpisode = autoPlay.nextEpisode;

  const dismissAutoPlay = useCallback((): boolean => {
    const courant = overlayRef.current;
    const etaitFin = courant.kind === "nextCard" && courant.final;
    dismissOverlay();
    if (etaitFin && endedRef.current) {
      setTimeout(() => { handleFinished(); }, 0);
      return true;
    }
    return false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dismissOverlay, overlayRef]);

  useEffect(() => {
    if (!ended) return;
    if (nextEpisode && autoplayEnabled) return;
    handleFinished();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ended, nextEpisode, autoplayEnabled]);

  return { dismissAutoPlay };
}
