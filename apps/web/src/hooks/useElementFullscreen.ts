import { useCallback, useEffect, useState, type RefObject } from "react";

/**
 * Le plein écran du lecteur web : l'état suivi sur `fullscreenchange` (Échap,
 * geste du système), et la bascule — le conteneur d'abord, la balise vidéo
 * sur Safari iOS, qui ne met en plein écran qu'elle (`webkitEnterFullscreen`).
 */
export function useElementFullscreen(
  containerRef: RefObject<HTMLElement | null>,
  videoRef: RefObject<HTMLVideoElement | null>,
): { fullscreen: boolean; toggleFullscreen: () => void } {
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) { void document.exitFullscreen(); return; }
    const el = containerRef.current;
    if (!el) return;
    if (el.requestFullscreen) { void el.requestFullscreen(); return; }
    const v = videoRef.current as HTMLVideoElement & { webkitEnterFullscreen?: () => void } | null;
    if (v?.webkitEnterFullscreen) v.webkitEnterFullscreen();
  }, [containerRef, videoRef]);

  return { fullscreen, toggleFullscreen };
}
