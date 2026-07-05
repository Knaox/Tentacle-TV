import { useEffect, useSyncExternalStore } from "react";

/**
 * Watch Together — pont de visibilité entre les pages player et la bulle de
 * chat. Sur une page de lecture, la bulle suit le fondu de l'overlay lecteur
 * (contrôles) au lieu de rester en permanence sur l'image. Store module
 * minimal : les pages Watch* publient, ChatOverlay consomme — pas de contexte
 * React (le chat vit dans un portail au-dessus du Router).
 */

export interface WatchOverlayState {
  /** Une page player (WatchWeb / WatchDesktop) est montée. */
  onWatchPage: boolean;
  /** Overlay lecteur (contrôles) actuellement affiché. */
  controlsVisible: boolean;
}

let state: WatchOverlayState = { onWatchPage: false, controlsVisible: true };
const listeners = new Set<() => void>();

function emit(next: WatchOverlayState): void {
  state = next;
  for (const listener of listeners) listener();
}

export function useWatchOverlayState(): WatchOverlayState {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => state,
  );
}

/** À monter dans chaque page player : publie la visibilité des contrôles,
 *  et se déclare « hors page player » au démontage. */
export function useReportPlayerOverlay(controlsVisible: boolean): void {
  useEffect(() => {
    emit({ onWatchPage: true, controlsVisible });
  }, [controlsVisible]);
  useEffect(() => () => emit({ onWatchPage: false, controlsVisible: true }), []);
}
