import { useEffect, useSyncExternalStore } from "react";
import { useLocation } from "react-router-dom";

/**
 * Le repli du chrome au défilement — `scrollChrome.tsx` de l'app : près du haut
 * (< 64 px) le chrome est plein ; douze pixels vers le bas le replient, douze
 * vers le haut le déploient. Changer de page le redéploie.
 *
 * Un booléen, pas une valeur continue : la barre et l'en-tête basculent par une
 * transition CSS (transform/opacity), sans rendu React à chaque image.
 */

export const SCROLL_CHROME_TUNING = { showNearTop: 64, delta: 12, durationMs: 250 } as const;

let collapsed = false;
let lastY = 0;
const listeners = new Set<() => void>();

function set(next: boolean) {
  if (next === collapsed) return;
  collapsed = next;
  listeners.forEach((l) => l());
}

/** La décision pure, testée : nouvel état à partir de la position et du pas. */
export function nextCollapsed(current: boolean, y: number, dy: number): boolean {
  if (y < SCROLL_CHROME_TUNING.showNearTop) return false;
  if (dy > SCROLL_CHROME_TUNING.delta) return true;
  if (dy < -SCROLL_CHROME_TUNING.delta) return false;
  return current;
}

function onScroll() {
  const y = window.scrollY;
  const dy = y - lastY;
  // Les petits pas s'accumulent jusqu'au seuil : un défilement lent replie aussi.
  if (Math.abs(dy) <= SCROLL_CHROME_TUNING.delta && y >= SCROLL_CHROME_TUNING.showNearTop) return;
  lastY = y;
  set(nextCollapsed(collapsed, y, dy));
}

function subscribe(l: () => void) {
  if (listeners.size === 0) {
    lastY = window.scrollY;
    window.addEventListener("scroll", onScroll, { passive: true });
  }
  listeners.add(l);
  return () => {
    listeners.delete(l);
    if (listeners.size === 0) window.removeEventListener("scroll", onScroll);
  };
}

export function useChromeCollapsed(): boolean {
  return useSyncExternalStore(subscribe, () => collapsed, () => false);
}

/** À poser une fois dans la coquille : un changement de page redéploie le chrome. */
export function useResetChromeOnNavigate(): void {
  const { pathname } = useLocation();
  useEffect(() => {
    lastY = window.scrollY;
    set(false);
  }, [pathname]);
}
