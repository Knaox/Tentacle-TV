import { useEffect, type MutableRefObject } from "react";
import { wtLog } from "../watchTogether/wtLog";
import { videoStalled } from "./videoStall";

const DBG = "[Tentacle:VideoPlayer]";
/** Cadence des relevés. */
const WATCH_PERIOD_MS = 2_000;
/** Recherche minime qui relance le décodeur sans changer l'image visée. */
const NUDGE_S = 0.1;
/** Au-delà, on cesse d'insister : ce n'est plus un gel qu'une recherche répare. */
const MAX_NUDGES = 3;
/** Relevés figés d'affilée avant d'agir : un décodeur matériel livre parfois
 *  ses images par rafales, un seul relevé vide n'est pas un gel. */
const STALLED_SAMPLES = 2;

/**
 * Veille de décodage du lecteur web : si la lecture avance sans qu'une seule
 * image ne sorte (cf. `videoStall.ts`), une recherche minime relance le
 * décodeur. Filet derrière `isMseSource` (élément neuf par sorte de source),
 * pour les navigateurs et les cas qu'on n'a pas mesurés.
 */
export function useVideoStallWatch(videoRef: MutableRefObject<HTMLVideoElement | null>, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    let lastTime: number | null = null;
    let lastFrames = 0;
    let nudges = 0;
    let streak = 0;
    const timer = setInterval(() => {
      const v = videoRef.current;
      if (!v || typeof v.getVideoPlaybackQuality !== "function") return;
      const frames = v.getVideoPlaybackQuality().totalVideoFrames;
      const time = v.currentTime;
      const prevTime = lastTime;
      const decoded = frames - lastFrames;
      lastTime = time;
      lastFrames = frames;
      if (prevTime === null) return;
      if (decoded > 0) { nudges = 0; streak = 0; return; }
      const stalled = videoStalled({
        playedS: time - prevTime, decodedFrames: decoded, paused: v.paused, seeking: v.seeking,
        readyState: v.readyState, visible: document.visibilityState === "visible", hasVideo: v.videoWidth > 0,
        framesCounted: frames > 0,
      });
      streak = stalled ? streak + 1 : 0;
      if (streak < STALLED_SAMPLES || nudges >= MAX_NUDGES) return;
      streak = 0;
      nudges += 1;
      console.warn(DBG, "décodeur vidéo arrêté pendant la lecture — recherche minime", { at: time.toFixed(2), nudges });
      wtLog("web-video", "gel du décodeur vidéo → recherche minime", { at: time.toFixed(2), nudges });
      v.currentTime = time + NUDGE_S;
    }, WATCH_PERIOD_MS);
    return () => clearInterval(timer);
  }, [videoRef, enabled]);
}
