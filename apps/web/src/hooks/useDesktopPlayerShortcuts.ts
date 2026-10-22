/**
 * Raccourcis clavier du lecteur desktop + badge « +30s / −10s ».
 * Extrait de DesktopPlayer (limite de 300 lignes par fichier) — logique
 * inchangée : cumul du badge sur appuis rapides dans le même sens.
 */

import { useEffect, type MutableRefObject } from "react";
import type { SkipFlash } from "../components/SkipBadge";
import { useSkipFlash } from "./useSkipFlash";

interface Options {
  seekRelative: (delta: number) => void;
  togglePause: () => void;
  goBack: () => void;
  toggleFullscreen: () => void;
  fullscreenRef: MutableRefObject<boolean>;
  hasNextEpisode?: boolean;
  hasPreviousEpisode?: boolean;
  onNextEpisode?: () => void;
  onPreviousEpisode?: () => void;
  /** Faux pendant le PiP : la page parcourt l'application, le clavier est à elle. */
  enabled?: boolean;
  /** Réduire la lecture dans le PiP — là où il existe (touche I, comme le mini-lecteur de YouTube). */
  onReduce?: () => void;
  /** Plein écran imposé (Linux, `useForcedFullscreen`) : Échap quitte le lecteur, il n'y a rien d'autre à quitter. */
  escapeLeaves?: boolean;
}

export function useDesktopPlayerShortcuts({
  seekRelative, togglePause, goBack, toggleFullscreen, fullscreenRef,
  hasNextEpisode, hasPreviousEpisode, onNextEpisode, onPreviousEpisode, enabled = true, onReduce, escapeLeaves = false,
}: Options): { skipFlash: SkipFlash | null; skipBy: (delta: number) => void } {
  const { skipFlash, skipBy } = useSkipFlash(seekRelative);

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); togglePause(); }
      if (e.code === "Escape") {
        if (fullscreenRef.current && !escapeLeaves) toggleFullscreen();
        else goBack();
      }
      if (e.code === "ArrowRight") skipBy(30);
      if (e.code === "ArrowLeft") skipBy(-10);
      if (e.code === "KeyF") toggleFullscreen();
      if (e.code === "KeyN" && hasNextEpisode) onNextEpisode?.();
      if (e.code === "KeyP" && hasPreviousEpisode) onPreviousEpisode?.();
      if (e.code === "KeyI") onReduce?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, togglePause, goBack, skipBy, toggleFullscreen, fullscreenRef, hasNextEpisode, hasPreviousEpisode, onNextEpisode, onPreviousEpisode, onReduce, escapeLeaves]);

  return { skipFlash, skipBy };
}
