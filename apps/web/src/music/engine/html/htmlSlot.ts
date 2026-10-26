/**
 * Un élément `<audio>` et ce qu'il joue : la « case » du moteur web (le courant,
 * le suivant préchargé, la source de bascule). Sans dépendre du DOM : le moteur
 * reçoit une fabrique d'éléments (`MediaElementLike`), le banc et les tests la
 * leur.
 */

import type { MusicTrack, PlaybackSource } from "@tentacle-tv/shared/music";

/** Ce que le moteur utilise d'un `HTMLAudioElement`. */
export interface MediaElementLike {
  src: string;
  currentTime: number;
  readonly duration: number;
  volume: number;
  muted: boolean;
  readonly paused: boolean;
  preload: string;
  crossOrigin: string | null;
  play(): Promise<void>;
  pause(): void;
  load(): void;
  removeAttribute(name: string): void;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
  setSinkId?: (sinkId: string) => Promise<void>;
}

export interface Slot {
  el: MediaElementLike;
  track: MusicTrack;
  source: PlaybackSource;
  /**
   * Le gain ReplayGain FIGÉ (dB) d'un titre pris dans une transition douce : en « auto », son gain suit les voisins
   * (album ou titre), qui changent au milieu du fondu — son volume sauterait (défaut 1 de la recette M2).
   */
  gainDb?: number;
  /** Retire les écouteurs posés par `on`. */
  off: () => void;
  on: (type: string, listener: () => void) => void;
  /** La métadonnée (durée) est-elle connue ? */
  ready: () => boolean;
}

export function makeSlot(el: MediaElementLike, track: MusicTrack, source: PlaybackSource, url: string, credentials: string | null): Slot {
  const listeners: Array<[string, () => void]> = [];
  let metadata = false;
  const markReady = (): void => {
    metadata = true;
  };
  el.addEventListener("loadedmetadata", markReady);
  listeners.push(["loadedmetadata", markReady]);
  el.preload = "auto";
  if (credentials !== null) el.crossOrigin = credentials;
  el.src = url;
  return {
    el,
    track,
    source,
    ready: () => metadata,
    on: (type, listener) => {
      el.addEventListener(type, listener);
      listeners.push([type, listener]);
    },
    off: () => {
      for (const [type, listener] of listeners.splice(0)) el.removeEventListener(type, listener);
    },
  };
}

/** Libère l'élément : écouteurs retirés, flux coupé (le navigateur ferme la connexion). */
export function releaseSlot(slot: Slot | null): void {
  if (slot === null) return;
  slot.off();
  slot.el.pause();
  slot.el.removeAttribute("src");
  slot.el.load();
}

/** Une seule fois, quand l'élément a sa métadonnée (tout de suite si c'est déjà le cas). */
export function whenReady(slot: Slot, run: () => void): void {
  if (slot.ready()) return run();
  let done = false;
  slot.on("loadedmetadata", () => {
    if (done) return;
    done = true;
    run();
  });
}

/** La durée restante du courant (s), ou `null` tant qu'elle n'est pas connue. */
export function remainingS(slot: Slot): number | null {
  const d = slot.el.duration;
  return Number.isFinite(d) && d > 0 ? Math.max(0, d - slot.el.currentTime) : null;
}
