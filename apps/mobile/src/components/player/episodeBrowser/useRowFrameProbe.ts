import { useCallback } from "react";
import { runOnJS, useFrameCallback, useSharedValue } from "react-native-reanimated";
import { rowFrameReport } from "../../../player/episodes/rowFrames";

/** Au-delà, un défilement est trop long pour un bilan lisible : on garde le début. */
const MAX_GAPS = 900;
/** Plus court qu'une image à 240 Hz : un second passage dans la même image. */
const MIN_FRAME_MS = 4;

function report(gaps: number[]): void {
  const { hz, frames, dropped, worstMs, medianMs, p90Ms, over60 } = rowFrameReport(gaps);
  console.log(
    `[épisodes] défilement : ${frames} images à ${hz} Hz, ${dropped} perdue(s), pire écart ${worstMs} ms`
      + ` (médiane ${medianMs} ms, 90e centile ${p90Ms} ms, ${over60} écart(s) > 25 ms)`,
  );
}

/**
 * DÉVELOPPEMENT SEULEMENT : le compte des images pendant qu'on fait défiler
 * la rangée — l'écart entre deux images sur le fil d'interface, du premier
 * contact à l'arrêt du défilement ; le bilan s'écrit dans Metro. En
 * production, l'horloge n'est jamais démarrée et les bornes ne font rien.
 */
export function useRowFrameProbe(): { begin: () => void; end: () => void } {
  const active = useSharedValue(false);
  const last = useSharedValue(0);
  const gaps = useSharedValue<number[]>([]);
  useFrameCallback((info) => {
    if (!active.value) return;
    const now = info.timestamp;
    // La boucle passe parfois deux fois dans la même image (un évènement de
    // défilement la relance) : un écart de moins de 4 ms n'est pas une image.
    if (last.value > 0 && now - last.value < MIN_FRAME_MS) return;
    if (last.value > 0 && gaps.value.length < MAX_GAPS) {
      gaps.modify((list) => {
        "worklet";
        list.push(now - last.value);
        return list;
      });
    }
    last.value = now;
  }, __DEV__);

  const begin = useCallback(() => {
    "worklet";
    if (!__DEV__ || active.value) return;
    gaps.value = [];
    last.value = 0;
    active.value = true;
  }, [active, gaps, last]);
  const end = useCallback(() => {
    "worklet";
    if (!__DEV__ || !active.value) return;
    active.value = false;
    if (gaps.value.length > 0) runOnJS(report)(gaps.value.slice());
  }, [active, gaps]);
  return { begin, end };
}
