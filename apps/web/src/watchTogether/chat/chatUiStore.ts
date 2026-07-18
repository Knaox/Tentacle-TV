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

// ── Canal inverse : activité du chat → timer d'auto-masquage du lecteur ──
// Le chat vit dans un portail HORS du conteneur vidéo : ses événements
// n'atteignent jamais le onMouseMove du lecteur. ChatOverlay publie ici son
// état « interaction en cours » (survol, saisie, gestes, resize) ; le timer
// des lecteurs le lit de façon synchrone avant de masquer les contrôles —
// le chat, lui, suit STRICTEMENT le fondu des contrôles (jamais de visibilité
// indépendante).
let chatActive = false;

/** Publié par ChatOverlay (remis à false à son démontage). */
export function reportChatActivity(active: boolean): void {
  chatActive = active;
}

/** Lu par les timers d'auto-masquage (VideoPlayer / DesktopPlayer). */
export function isChatActive(): boolean {
  return chatActive;
}
