import { useEffect } from "react";
import { parseStart } from "../utils/playerHelpers";

/**
 * Ce qu'il faut remettre à zéro à chaque (re)chargement de source.
 *
 * Réafficher l'écran de chargement jusqu'à la première position réelle du
 * nouveau flux, ré-armer la fin, et armer la fenêtre post-seek sur la position
 * de départ RÉELLE — celle que porte le fragment de l'URL, atomique avec elle :
 * armer sur le T demandé ratait la convergence quand la session démarre à la
 * keyframe qui le précède.
 *
 * Le reload DOUX (piste, qualité — même contenu) est l'exception : il garde la
 * dernière image et son spinner discret, sans repasser par l'écran de
 * chargement.
 */
export function useTVSourceReset(args: {
  streamUrl: string | null;
  softReloadRef: React.MutableRefObject<boolean>;
  endedRef: React.MutableRefObject<boolean>;
  resetLoadedRef: React.MutableRefObject<() => void>;
  notifySeekRef: React.MutableRefObject<(target: number, windowMs?: number, afterReload?: boolean) => void>;
  setEnded: (v: boolean) => void;
  setHasStarted: (v: boolean) => void;
  setIsLoading: (v: boolean) => void;
}): void {
  const {
    streamUrl, softReloadRef, endedRef, resetLoadedRef, notifySeekRef,
    setEnded, setHasStarted, setIsLoading,
  } = args;

  useEffect(() => {
    if (!streamUrl) return;
    resetLoadedRef.current();
    endedRef.current = false;
    setEnded(false);
    if (softReloadRef.current) {
      softReloadRef.current = false;
    } else {
      setHasStarted(false);
    }
    setIsLoading(true);
    const armAt = parseStart(streamUrl).startSec;
    if (armAt > 1) notifySeekRef.current(armAt, 8000, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamUrl]);
}
