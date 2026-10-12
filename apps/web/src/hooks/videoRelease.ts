import { useCallback, useEffect, useRef, type MutableRefObject } from "react";

/** Ce que la sortie demande à l'élément — un `HTMLVideoElement`, ou son double de test. */
export type ReleasableVideo = Pick<HTMLVideoElement, "pause" | "removeAttribute" | "load">;

/** Ce que la sortie demande à hls.js. */
export interface ReleasableHls {
  destroy(): void;
}

/**
 * Le lecteur web lâche son flux : hls.js détruit, l'élément mis en pause et
 * vidé de sa source.
 *
 * Un `<video>` retiré du document se met en pause de lui-même, mais garde sa
 * source : il continue de tenir la connexion (et, en lecture directe, de
 * télécharger), et le moindre `play()` tardif — un rappel en retard, une
 * commande à distance — le relance hors de la page, le son seul audible
 * (mesuré sous Chrome). `removeAttribute("src")` puis `load()` le remet à zéro :
 * plus de flux, plus de décodeur, plus rien à relancer.
 */
export function releaseVideoSource(video: ReleasableVideo | null, hls: ReleasableHls | null): void {
  hls?.destroy();
  if (video === null) return;
  video.pause();
  video.removeAttribute("src");
  video.load();
}

/**
 * Pour `useVideoSource` : l'élément qui a reçu la source est lâché quand une
 * balise neuve le remplace (une par sorte de source, cf. `isMseSource`) et à la
 * sortie du lecteur — avec hls.js, quel que soit le geste. Gardé ici et non lu
 * sur `videoRef` : au démontage, celui-ci vaut déjà null.
 *
 * Renvoie `holdSource(video)`, à appeler quand la source est donnée à `video`.
 */
export function useVideoRelease(hlsRef: MutableRefObject<ReleasableHls | null>): (video: HTMLVideoElement) => void {
  const mediaRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => () => {
    releaseVideoSource(mediaRef.current, hlsRef.current);
    hlsRef.current = null;
  }, [hlsRef]);
  return useCallback((video: HTMLVideoElement) => {
    if (mediaRef.current !== video) releaseVideoSource(mediaRef.current, null);
    mediaRef.current = video;
  }, []);
}
