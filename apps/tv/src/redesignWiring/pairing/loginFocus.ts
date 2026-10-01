import { useEffect } from "react";
import type { FocusStore } from "../focus/focusStore";

const USERNAME_KEY = "pairing:username";
const PASSWORD_KEY = "pairing:password";

/** Le temps où tvOS peut encore rendre le focus au champ du clavier refermé. */
const RESTORE_WINDOW_MS = 1200;

/**
 * Une connexion refusée vide le mot de passe et lui donne le focus
 * (`entryKeyOf`). Mais le refus arrive souvent pendant que le clavier du mot
 * de passe se retire, et tvOS rend ENSUITE le focus au champ qui l'avait
 * ouvert — l'identifiant, quand sa validation a enchaîné sur le mot de passe
 * —, défaisant la réclamation (mesuré). Si l'identifiant reprend ainsi le
 * focus juste après le refus, on le rend une fois au mot de passe.
 */
export function useLoginErrorFocus(store: FocusStore, error: object | null): void {
  useEffect(() => {
    if (!error) return undefined;
    let cancelClaim: (() => void) | null = null;
    let watching = true;
    const unsubscribe = store.subscribe((focusKey, focused) => {
      if (!watching || !focused || focusKey !== USERNAME_KEY) return;
      watching = false;
      cancelClaim = store.claim(PASSWORD_KEY);
    });
    const timer = setTimeout(() => {
      watching = false;
    }, RESTORE_WINDOW_MS);
    return () => {
      clearTimeout(timer);
      unsubscribe();
      cancelClaim?.();
    };
  }, [error, store]);
}
