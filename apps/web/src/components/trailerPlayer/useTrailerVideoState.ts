/**
 * L'état du `<video>` de la bande-annonce, suivi par ses évènements : lecture,
 * position, durée, tampon — et la mise en route à chaque flux neuf, avec le
 * son, ou en muet si le navigateur refuse une lecture sonore (le web sans
 * geste récent ; Electron ne refuse jamais).
 */

import { useCallback, useEffect, useState, type MutableRefObject } from "react";

export interface TrailerVideoState {
  playing: boolean;
  currentTime: number;
  duration: number;
  /** La part tamponnée devant la position, de 0 à 1. */
  buffered: number;
}

const IDLE: TrailerVideoState = { playing: false, currentTime: 0, duration: 0, buffered: 0 };

function bufferedRatio(video: HTMLVideoElement): number {
  if (!video.duration || !Number.isFinite(video.duration)) return 0;
  for (let i = 0; i < video.buffered.length; i++) {
    if (video.buffered.start(i) <= video.currentTime + 0.5 && video.buffered.end(i) >= video.currentTime) {
      return Math.min(1, video.buffered.end(i) / video.duration);
    }
  }
  return 0;
}

export function useTrailerVideoState(videoRef: MutableRefObject<HTMLVideoElement | null>, streamKey: string | null) {
  const [state, setState] = useState<TrailerVideoState>(IDLE);

  useEffect(() => {
    setState(IDLE);
    const video = videoRef.current;
    if (!video || !streamKey) return;
    const read = () => setState({
      playing: !video.paused && !video.ended,
      currentTime: video.currentTime,
      duration: Number.isFinite(video.duration) ? video.duration : 0,
      buffered: bufferedRatio(video),
    });
    const events = ["play", "pause", "timeupdate", "durationchange", "progress", "ended", "seeked"] as const;
    for (const name of events) video.addEventListener(name, read);

    // La mise en route : avec le son, sinon en muet (le bouton du son le rend d'un clic).
    // Dès les métadonnées : hls.js pose sa source après coup (chargé à la demande).
    let cancelled = false;
    const start = () => {
      void video.play().catch((error: unknown) => {
        if (cancelled || (error as { name?: string })?.name !== "NotAllowedError") return;
        video.muted = true;
        void video.play().catch(() => undefined);
      });
    };
    video.addEventListener("loadedmetadata", start, { once: true });
    return () => {
      cancelled = true;
      video.removeEventListener("loadedmetadata", start);
      for (const name of events) video.removeEventListener(name, read);
    };
  }, [videoRef, streamKey]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused || video.ended) void video.play().catch(() => undefined);
    else video.pause();
  }, [videoRef]);

  const seek = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    const end = Number.isFinite(video.duration) ? video.duration : seconds;
    video.currentTime = Math.max(0, Math.min(end, seconds));
  }, [videoRef]);

  const seekRelative = useCallback((delta: number) => {
    const video = videoRef.current;
    if (video) seek(video.currentTime + delta);
  }, [videoRef, seek]);

  return { ...state, togglePlay, seek, seekRelative };
}
