import { useEffect } from "react";
import type { FocusStore } from "./focusStore";

/** Délai avant de conclure que le focus est sorti : le voisin qui le reçoit
 *  peut annoncer son focus après le flou de celui qui le perd. */
const LEAVE_CHECK_MS = 50;

/**
 * GARDER le focus dans une surface qui couvre tout l'écran, tant qu'elle est
 * montée — le voile hors ligne. Le focus y entre par `entryKey` ; s'il en
 * sort sans revenir à l'une de ses clés, c'est qu'un écran d'en dessous l'a
 * réclamé (l'état d'erreur de l'accueil naît de la même panne, une
 * cinquantaine de millisecondes plus tard) : il est ramené sur la dernière
 * clé qui l'a tenu. Le pavé, lui, ne peut pas en sortir (piège du groupe) :
 * reprendre ne contrarie jamais l'utilisateur. Pendant de `useKeepTvFocus`,
 * par les clés du magasin au lieu des refs.
 */
export function useKeepFocusWithin(store: FocusStore, keys: readonly string[], entryKey: string): void {
  useEffect(() => {
    const own = new Set(keys);
    let last = entryKey;
    let leaveTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelClaim = store.claim(entryKey);
    const unsubscribe = store.subscribe((key, focused) => {
      if (!own.has(key)) return;
      if (focused) {
        last = key;
        if (leaveTimer) clearTimeout(leaveTimer);
        leaveTimer = null;
        return;
      }
      if (leaveTimer) clearTimeout(leaveTimer);
      leaveTimer = setTimeout(() => {
        leaveTimer = null;
        const current = store.focusedKey();
        if (current && own.has(current)) return;
        cancelClaim();
        cancelClaim = store.claim(last);
      }, LEAVE_CHECK_MS);
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
