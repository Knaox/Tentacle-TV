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
 * ⚠️ `blur` part aussi quand le focus entre dans une IFRAME de la page (les
 * extensions) : la fenêtre reste active. D'où `document.hasFocus()`, vrai tant
 * que le focus est dans le document OU l'un de ses cadres — lu au tour
 * suivant, quand le navigateur a fini de déplacer le focus.
 */
export function useWindowInactiveAttribute(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const root = document.documentElement;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const apply = () => {
      timer = null;
      if (document.hasFocus()) delete root.dataset["windowInactive"];
      else root.dataset["windowInactive"] = "on";
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
      delete root.dataset["windowInactive"];
    };
  }, [enabled]);
}
