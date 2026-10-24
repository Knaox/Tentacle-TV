/**
 * Octave — ce que l'interface lit du lecteur : un INSTANTANÉ (titre, état,
 * file, volume) et, à part, la POSITION — qui change plusieurs fois par
 * seconde et ne doit faire redessiner que la barre de progression.
 */

import type { EngineState, MusicAudioFormat, MusicTrack, PlaybackSource } from "../music";
import { EMPTY_QUEUE, type QueueState } from "./queueModel";

/**
 * `starting` : le titre est choisi et affiché, le son arrive (aucun spinner :
 * la barre montre déjà le titre et « Pause »). `stalled` : le moteur attend des
 * données en cours de lecture.
 */
export type PlayerPhase = "idle" | "starting" | "playing" | "paused" | "stalled" | "ended" | "error";

/** Liste fermée : l'interface a ses mots pour chacune. */
export type PlayerErrorKind = "noSource" | "engine";

export interface PlayerSnapshot {
  queue: QueueState;
  current: MusicTrack | null;
  /** L'intention de l'utilisateur : le bouton Lecture/Pause la reflète AU CLIC. */
  wantsPlay: boolean;
  phase: PlayerPhase;
  durationMs: number | null;
  volume: number;
  muted: boolean;
  /** Le format réellement décodé si le moteur l'a dit, sinon celui du titre. */
  format: MusicAudioFormat | null;
  origin: PlaybackSource["origin"] | null;
  error: PlayerErrorKind | null;
}

export const INITIAL_SNAPSHOT: PlayerSnapshot = {
  queue: EMPTY_QUEUE,
  current: null,
  wantsPlay: false,
  phase: "idle",
  durationMs: null,
  volume: 1,
  muted: false,
  format: null,
  origin: null,
  error: null,
};

/** La phase affichée d'après l'état du moteur (une attente au démarrage reste « starting »). */
export function enginePhase(status: EngineState["status"], current: PlayerPhase): PlayerPhase {
  if (status === "playing" || status === "paused" || status === "error" || status === "ended") return status;
  if (status === "buffering") return current === "starting" ? "starting" : "stalled";
  return current;
}

export interface PositionState {
  positionMs: number;
  durationMs: number | null;
  /** Le son avance : la barre peut glisser entre deux nouvelles du moteur. */
  running: boolean;
}

export const INITIAL_POSITION: PositionState = { positionMs: 0, durationMs: null, running: false };

/** Un magasin minimal pour `useSyncExternalStore` : même valeur → aucune notification. */
export class ValueStore<T> {
  private readonly listeners = new Set<() => void>();

  constructor(private value: T) {}

  get = (): T => this.value;

  set(next: T): void {
    if (Object.is(next, this.value)) return;
    this.value = next;
    for (const listener of this.listeners) listener();
  }

  update(patch: Partial<T>): void {
    const current = this.value;
    let changed = false;
    for (const key of Object.keys(patch) as (keyof T)[]) {
      if (!Object.is(patch[key], current[key])) changed = true;
    }
    if (changed) this.set({ ...current, ...patch });
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
}
