import { useCallback } from "react";
import { runOnJS, useFrameCallback, useSharedValue } from "react-native-reanimated";
import { rowFrameReport } from "../../../player/episodes/rowFrames";

/** Au-delà, un défilement est trop long pour un bilan lisible : on garde le début. */
const MAX_GAPS = 900;

function report(gaps: number[]): void {
  const { hz, frames, dropped, worstMs } = rowFrameReport(gaps);
  console.log(`[épisodes] défilement : ${frames} images à ${hz} Hz, ${dropped} perdue(s), pire écart ${worstMs} ms`);
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
