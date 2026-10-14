/**
 * Le chien de garde de la bande-annonce, celui des téléviseurs
 * (`useTrailerPlaybackWatch`, mêmes seuils) : une lecture qui finit TOUJOURS
 * — par l'image, par sa fin, ou par un échec que le lecteur traduit en geste
 * (la suivante, le lecteur officiel).
 *
 * - « Démarrée » à la première image (`loadeddata` puis `playing`).
 * - Pas d'image en 15 s : échec.
 * - Lancée et pas en pause, le temps n'avance plus : l'attente se montre au
 *   bout d'une seconde ; au bout de 15 s, c'est la fin si l'on est au bout,
 *   l'échec sinon. Une page cachée ne compte pas.
 *
 * `onStarted` reçoit le délai depuis la pose du flux, pour le compte rendu.
 */

import { useEffect, useRef, useState, type MutableRefObject } from "react";

export const TRAILER_START_TIMEOUT_MS = 15_000;
export const TRAILER_STALL_TIMEOUT_MS = 15_000;
const WAIT_SHOW_MS = 1_000;
const TICK_MS = 500;
/** À moins de deux secondes de la fin, un arrêt EST la fin. */
const END_SLACK_S = 2;

interface Callbacks {
  onStarted: (ms: number) => void;
  onFailed: (reason: string) => void;
  onEnded: () => void;
}

/** Rend `waiting` : la lecture lancée attend ses données (le voile d'attente). */
export function useTrailerWatch(
  videoRef: MutableRefObject<HTMLVideoElement | null>,
  streamKey: string | null,
  callbacks: Callbacks,
): { started: boolean; waiting: boolean } {
  const latest = useRef(callbacks);
  latest.current = callbacks;
  const [started, setStarted] = useState(false);
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    setStarted(false);
    setWaiting(false);
    const video = videoRef.current;
    if (!video || !streamKey) return;
    const openedAt = Date.now();
    let isStarted = false;
    let done = false;
    let lastTime = -1;
    let lastMove = Date.now();

    const finish = (reason: string | null) => {
      if (done) return;
      done = true;
      setWaiting(false);
      if (reason === null) latest.current.onEnded();
      else latest.current.onFailed(reason);
    };
    const start = () => {
      if (isStarted || done) return;
      isStarted = true;
      lastMove = Date.now();
      setStarted(true);
      latest.current.onStarted(Date.now() - openedAt);
    };
    const onEnded = () => finish(null);
    video.addEventListener("loadeddata", start);
    video.addEventListener("playing", start);
    video.addEventListener("ended", onEnded);

    const tick = setInterval(() => {
      const now = Date.now();
      if (done) return;
      if (!isStarted) {
        if (now - openedAt > TRAILER_START_TIMEOUT_MS) finish(`aucune image en ${TRAILER_START_TIMEOUT_MS / 1000} s`);
        return;
      }
      const moving = video.currentTime !== lastTime;
      lastTime = video.currentTime;
      // En pause, page cachée, déplacement en cours : rien n'est attendu.
      if (moving || video.paused || video.seeking || (typeof document !== "undefined" && document.visibilityState === "hidden")) {
        lastMove = now;
        setWaiting(false);
        return;
      }
      if (now - lastMove > WAIT_SHOW_MS) setWaiting(true);
      if (now - lastMove > TRAILER_STALL_TIMEOUT_MS) {
        const atEnd = video.duration > 0 && video.currentTime >= video.duration - END_SLACK_S;
        finish(atEnd ? null : `lecture arrêtée ${TRAILER_STALL_TIMEOUT_MS / 1000} s à ${video.currentTime.toFixed(1)} s`);
      }
    }, TICK_MS);

    return () => {
      done = true;
      clearInterval(tick);
      video.removeEventListener("loadeddata", start);
      video.removeEventListener("playing", start);
      video.removeEventListener("ended", onEnded);
    };
  }, [videoRef, streamKey]);

  return { started, waiting };
}
