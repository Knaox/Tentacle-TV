/**
 * Raccourcis clavier du lecteur desktop + badge « +30s / −10s ».
 * Extrait de DesktopPlayer (limite de 300 lignes par fichier) — logique
 * inchangée : cumul du badge sur appuis rapides dans le même sens.
 */

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import type { SkipFlash } from "../components/SkipBadge";

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
}

export function useDesktopPlayerShortcuts({
  seekRelative, togglePause, goBack, toggleFullscreen, fullscreenRef,
  hasNextEpisode, hasPreviousEpisode, onNextEpisode, onPreviousEpisode,
}: Options): { skipFlash: SkipFlash | null; skipBy: (delta: number) => void } {
  const [skipFlash, setSkipFlash] = useState<SkipFlash | null>(null);
  const skipFlashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const skipAccumRef = useRef(0);
  useEffect(() => () => clearTimeout(skipFlashTimer.current), []);

  const skipBy = useCallback((delta: number) => {
    seekRelative(delta);
    // Appuis rapides dans le MÊME sens → cumul de l'affichage (+30 → +60 → +90),
    // façon TV/Netflix. mpv coalesce déjà les seeks relatifs, on ne cumule donc
    // que le badge. Reset au changement de sens ou après 1,5 s d'inactivité.
    const sameDir = skipAccumRef.current !== 0 && Math.sign(delta) === Math.sign(skipAccumRef.current);
    skipAccumRef.current = sameDir ? skipAccumRef.current + delta : delta;
    setSkipFlash({ delta: skipAccumRef.current, id: Date.now() });
    clearTimeout(skipFlashTimer.current);
    skipFlashTimer.current = setTimeout(() => { skipAccumRef.current = 0; setSkipFlash(null); }, 1500);
  }, [seekRelative]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); togglePause(); }
      if (e.code === "Escape") {
        if (fullscreenRef.current) toggleFullscreen();
        else goBack();
      }
      if (e.code === "ArrowRight") skipBy(30);
      if (e.code === "ArrowLeft") skipBy(-10);
      if (e.code === "KeyF") toggleFullscreen();
      if (e.code === "KeyN" && hasNextEpisode) onNextEpisode?.();
      if (e.code === "KeyP" && hasPreviousEpisode) onPreviousEpisode?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePause, goBack, skipBy, toggleFullscreen, fullscreenRef, hasNextEpisode, hasPreviousEpisode, onNextEpisode, onPreviousEpisode]);

  return { skipFlash, skipBy };
}
