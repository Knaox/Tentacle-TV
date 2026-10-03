import { useEffect } from "react";
import { KEEP_WITHIN_CHECK_MS, keepWithinReclaim, keepWithinStep, startKeepWithin } from "@tentacle-tv/tv-core";
import type { FocusStore } from "./focusStore";

/**
 * GARDER le focus dans une surface qui couvre tout l'écran, tant qu'elle est
 * montée — le voile hors ligne. La règle est celle de tv-core
 * (`focus/keepWithin.ts`) : le focus y entre par `entryKey` ; sorti sans
 * revenir à l'une de ses clés (un écran d'en dessous l'a réclamé), il est
 * ramené sur la dernière clé qui l'a tenu. Ce crochet tient le minuteur et
 * applique les réclamations. Pendant de `useKeepTvFocus`, par les clés du
 * magasin au lieu des refs.
 */
export function useKeepFocusWithin(store: FocusStore, keys: readonly string[], entryKey: string): void {
  useEffect(() => {
    const own = new Set(keys);
    const owns = (key: string) => own.has(key);
    let state = startKeepWithin(entryKey);
    let leaveTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelClaim = store.claim(entryKey);
    const unsubscribe = store.subscribe((key, focused) => {
      const step = keepWithinStep(key, focused, owns);
      if (step.kind === "ignore") return;
      if (leaveTimer) clearTimeout(leaveTimer);
      leaveTimer = null;
      if (step.kind === "held") {
        state = step.state;
        return;
      }
      leaveTimer = setTimeout(() => {
        leaveTimer = null;
        const reclaim = keepWithinReclaim(state, store.focusedKey(), owns);
        if (!reclaim) return;
        cancelClaim();
        cancelClaim = store.claim(reclaim);
      }, KEEP_WITHIN_CHECK_MS);
    });
    return () => {
      unsubscribe();
      if (leaveTimer) clearTimeout(leaveTimer);
      cancelClaim();
    };
    // Les clés d'une surface sont fixes : sa liste n'est lue qu'au montage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, entryKey]);
}
