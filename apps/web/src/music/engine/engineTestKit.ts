/**
 * Des titres, des sources et de faux éléments `<audio>` pour les tests du
 * moteur (sans DOM : les tests du web tournent sous Node).
 */

import type { MusicTrack, PlaybackSource } from "@tentacle-tv/shared/music";
import type { MediaElementLike } from "./html/htmlSlot";

export function testTrack(key: string, album = "A"): MusicTrack {
  return {
    key, jellyfinId: key, external: null, title: key, artists: [{ name: "Artiste", mbid: null, jellyfinId: null }],
    album: { title: album, mbid: null, jellyfinId: album }, durationMs: 200_000, trackNumber: 1, discNumber: 1, year: null,
    artworkUrl: null, mbids: { recording: null, release: null, releaseGroup: null, artists: [] }, availability: "library",
    format: null, favorite: false,
  };
}

export function testSource(path: string, origin: "library" | "plugin" = "library", complete = true): PlaybackSource {
  return { trackKey: path, url: path, origin, complete, sizeBytes: null, durationMs: 200_000, format: null, replayGain: null, expiresAt: null };
}

/** Un faux `<audio>` : ses évènements se déclenchent à la main (`fire`). */
export class FakeElement implements MediaElementLike {
  src = "";
  currentTime = 0;
  duration = Number.NaN;
  volume = 1;
  muted = false;
  paused = true;
  preload = "";
  crossOrigin: string | null = null;
  plays = 0;
  sinkId: string | null = null;
  private readonly listeners = new Map<string, Set<() => void>>();

  play(): Promise<void> {
    this.plays += 1;
    this.paused = false;
    return Promise.resolve();
  }
  pause(): void {
    this.paused = true;
  }
  load(): void {}
  removeAttribute(name: string): void {
    if (name === "src") this.src = "";
  }
  addEventListener(type: string, listener: () => void): void {
    const set = this.listeners.get(type) ?? new Set();
    set.add(listener);
    this.listeners.set(type, set);
  }
  removeEventListener(type: string, listener: () => void): void {
    this.listeners.get(type)?.delete(listener);
  }
  setSinkId(id: string): Promise<void> {
    this.sinkId = id;
    return Promise.resolve();
  }
  fire(type: string): void {
    for (const l of [...(this.listeners.get(type) ?? [])]) l();
  }
  /** Métadonnée connue : durée posée, `loadedmetadata`. */
  loaded(durationS: number): void {
    this.duration = durationS;
    this.fire("loadedmetadata");
  }
}

/** Des minuteurs à la main : `tick(ms)` fait avancer le temps. */
export class FakeTimers {
  time = 0;
  private queue: Array<{ at: number; fn: () => void; id: number }> = [];
  private nextId = 1;
  setTimeout = (fn: () => void, ms: number): unknown => {
    const id = this.nextId++;
    this.queue.push({ at: this.time + ms, fn, id });
    return id;
  };
  clearTimeout = (id: unknown): void => {
    this.queue = this.queue.filter((t) => t.id !== id);
  };
  now = (): number => this.time;
  tick(ms: number): void {
    const end = this.time + ms;
    for (;;) {
      this.queue.sort((a, b) => a.at - b.at);
      const first = this.queue[0];
      if (first === undefined || first.at > end) break;
      this.queue.shift();
      this.time = first.at;
      first.fn();
    }
    this.time = end;
  }
}
