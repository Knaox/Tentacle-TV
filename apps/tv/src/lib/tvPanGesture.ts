import { useEffect } from "react";
import { Platform, TVEventControl } from "react-native";

/**
 * Le PAN continu du pavé tactile de la Siri Remote, partagé par compteur.
 *
 * `TVEventControl.enableTVPanGesture()` pose UN reconnaisseur de pan sur la
 * vue racine, pour toute l'application (un drapeau statique côté natif), et
 * tant qu'il est posé les glissers directionnels ne passent plus (constat du
 * lecteur, `hooks/useScrubGestures.ios.ts`). Deux propriétaires qui
 * l'allument et l'éteignent chacun de leur côté se coupent l'un l'autre : le
 * premier qui relâche l'éteint sous le second.
 *
 * D'où le compteur : chacun ACQUIERT le pan et reçoit de quoi le libérer. Le
 * pan s'allume à la première acquisition, s'éteint à la dernière libération ;
 * une libération rejouée ne compte qu'une fois. Les événements `pan` arrivent
 * ensuite par `TVEventHandler`, à qui les écoute.
 *
 * Apple TV seulement : là où le reconnaisseur n'existe pas (Android TV),
 * acquérir ne fait rien du tout.
 */

const SUPPORTED = Platform.OS === "ios" && typeof TVEventControl?.enableTVPanGesture === "function";

let holders = 0;

/** Tient le pan allumé jusqu'à l'appel de la fonction rendue. */
export function acquirePanGesture(): () => void {
  if (!SUPPORTED) return () => {};
  holders += 1;
  if (holders === 1) TVEventControl.enableTVPanGesture();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holders -= 1;
    if (holders === 0) TVEventControl.disableTVPanGesture();
  };
}

/** Le pan tenu tant que `enabled` est vrai (et l'appelant monté). */
export function usePanGesture(enabled: boolean): void {
  useEffect(() => (enabled ? acquirePanGesture() : undefined), [enabled]);
}
