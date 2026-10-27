import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/**
 * « Réduire les animations » du système, suivi EN DIRECT (Chromium relaie le
 * réglage de macOS, § 6 de docs/LIQUID-GLASS.md). `useReducedMotion` de framer ne
 * lit la préférence qu'au montage : l'habillage du lecteur, jamais démonté, ne la
 * voyait pas changer en cours de lecture (mesuré au banc, lg8).
 */
export function useLiveReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}

function media(): MediaQueryList | null {
  return typeof window === "undefined" || typeof window.matchMedia !== "function" ? null : window.matchMedia(QUERY);
}

function subscribe(onChange: () => void): () => void {
  const list = media();
  if (list === null) return () => undefined;
  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
}

const snapshot = (): boolean => media()?.matches === true;
