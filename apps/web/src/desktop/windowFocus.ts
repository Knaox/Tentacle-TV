import { useEffect } from "react";

/**
 * La fenêtre INACTIVE, façon macOS : quand elle perd le focus, la barre
 * d'outils se ternit — la lentille de l'onglet et la sélection de la barre
 * latérale passent au gris, le verre perd sa saturation. Les feux, eux, sont
 * grisés par le système.
 *
 * Pose `data-window-inactive` sur `<html>` ; les règles vivent dans
 * `windowGlass*.css`, portées par le mode natif. Rien n'est animé : un seul
 * recalcul de style par changement de focus.
 *
 * # La source : le processus principal, pas la page
 *
 * ⚠️ `document.hasFocus()` ne dit pas le focus de la FENÊTRE (mesuré au banc,
 * fenêtre ouverte sans focus) : au chargement il vaut ce que Chromium suppose,
 * sans `blur` pour le corriger, et dès qu'un outil pilote la page il passe à
 * vrai alors que `BrowserWindow.isFocused()` reste faux. Le pont
 * `window.tentacle.windowFocus` (lg-natif) relaie l'état du principal ; sans
 * lui (bureau d'avant), repli sur la page : `focus`/`blur` et `hasFocus()`, lu
 * au tour suivant — `blur` part aussi quand le focus entre dans l'IFRAME
 * d'une extension, et la fenêtre reste alors active.
 */

interface WindowFocusBridge {
  /** État courant, figé au moment de l'appel. */
  isFocused(): boolean;
  /** Chaque changement ; rend le désabonnement. */
  subscribe(listener: (focused: boolean) => void): () => void;
}

function focusBridge(): WindowFocusBridge | null {
  // Lu sans élargir `ElectronBridge` tant que le champ n'y est pas déclaré.
  const bridge = (window.tentacle as unknown as { windowFocus?: WindowFocusBridge } | undefined)?.windowFocus;
  return bridge && typeof bridge.isFocused === "function" && typeof bridge.subscribe === "function" ? bridge : null;
}

function setInactive(inactive: boolean): void {
  const root = document.documentElement;
  if (inactive) root.dataset["windowInactive"] = "on";
  else delete root.dataset["windowInactive"];
}

export function useWindowInactiveAttribute(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const bridge = focusBridge();
    if (bridge) {
      setInactive(!bridge.isFocused());
      const unsubscribe = bridge.subscribe((focused) => setInactive(!focused));
      return () => {
        unsubscribe();
        setInactive(false);
      };
    }
    let timer: ReturnType<typeof setTimeout> | null = null;
    const apply = () => {
      timer = null;
      setInactive(!document.hasFocus());
    };
    const schedule = () => {
      if (timer === null) timer = setTimeout(apply, 0);
    };
    apply();
    window.addEventListener("focus", schedule);
    window.addEventListener("blur", schedule);
    return () => {
      window.removeEventListener("focus", schedule);
      window.removeEventListener("blur", schedule);
      if (timer !== null) clearTimeout(timer);
      setInactive(false);
    };
  }, [enabled]);
}
