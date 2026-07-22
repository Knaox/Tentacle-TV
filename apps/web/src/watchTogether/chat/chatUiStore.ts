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
// n'atteignent jamais le onMouseMove du lecteur. Le chat publie donc ici des
// IMPULSIONS d'activité horodatées (frappe, pointeur en mouvement, molette,
// focus) qui expirent SEULES — jamais d'état collant : un focus resté dans
// l'input après l'envoi d'un message, ou un pointerleave raté quand le
// panneau se replie sous le curseur, ne peuvent pas bloquer le masquage. Seul
// le drag de redimensionnement pose un verrou dur, borné par son pointerup.
let chatLastActivityAt = 0;
let chatResizeLock = false;

/** Fenêtre pendant laquelle une impulsion maintient les contrôles visibles. */
const CHAT_ACTIVITY_MS = 4000;

/** Impulsion d'activité — publiée par useChatActivity (conteneurs du chat). */
export function markChatActivity(): void {
  chatLastActivityAt = Date.now();
}

/** Verrou dur pendant le drag de redimensionnement du panneau (ChatOverlay). */
export function setChatResizeLock(locked: boolean): void {
  chatResizeLock = locked;
  if (locked) chatLastActivityAt = Date.now();
}

/** Lu par les timers d'auto-masquage (useControlsAutoHide). */
export function isChatActive(): boolean {
  return chatResizeLock || Date.now() - chatLastActivityAt < CHAT_ACTIVITY_MS;
}

// ── Réveil : frappe dans le chat pendant que l'overlay est caché ──
// Après masquage, le focus peut être resté dans l'input (invisible) : taper
// doit re-afficher contrôles ET chat. Le lecteur monté enregistre ici son
// scheduleHide ; useChatActivity l'appelle sur chaque keydown.
let controlsWaker: (() => void) | null = null;

/** Enregistré par le lecteur (useControlsAutoHide) ; retourne le cleanup. */
export function registerControlsWaker(waker: () => void): () => void {
  controlsWaker = waker;
  return () => {
    if (controlsWaker === waker) controlsWaker = null;
  };
}

/** Appelé par le chat (frappe) : relance l'affichage des contrôles. */
export function wakePlayerControls(): void {
  controlsWaker?.();
}
