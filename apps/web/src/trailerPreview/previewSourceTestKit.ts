/**
 * Le banc des tests de la source d'un aperçu (`previewSource*.test.ts`) : un
 * faux `<video>`, un faux hls.js, deux flux. Ce module n'est pas un test.
 */
import type Hls from "hls.js";
import type { TrailerPreviewStream } from "./previewTypes";

type Listener = (...args: unknown[]) => void;

export class FakeVideo {
  muted = false;
  preload = "";
  playsInline = false;
  src = "";
  paused = true;
  readonly listeners = new Map<string, Set<Listener>>();
  readonly calls: string[] = [];
  constructor(private readonly native: string = "") {}
  canPlayType(type: string) {
    return type === "video/mp4" || type === this.native ? "maybe" : "";
  }
  addEventListener(type: string, listener: Listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }
  removeEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener);
  }
  emit(type: string) {
    for (const listener of this.listeners.get(type) ?? []) listener();
  }
  pause() {
    this.calls.push("pause");
  }
  removeAttribute(name: string) {
    this.calls.push(`removeAttribute:${name}`);
  }
  load() {
    this.calls.push("load");
  }
}

export const EVENTS = { MANIFEST_PARSED: "manifestParsed", LEVEL_LOADED: "levelLoaded", FRAG_LOADED: "fragLoaded", ERROR: "hlsError" } as const;

export function fakeHlsClass(supported = true) {
  const instances: FakeHls[] = [];
  class FakeHls {
    static Events = EVENTS;
    static isSupported = () => supported;
    readonly handlers = new Map<string, Listener>();
    startLevelValue = -1;
    autoLevelCapping = -1;
    nextAutoLevel = -1;
    loadLevel = -1;
    levels: unknown[] = [];
    readonly calls: string[] = [];
    constructor(readonly config: unknown) {
      instances.push(this);
    }
    set startLevel(level: number) {
      this.startLevelValue = level;
    }
    on(event: string, handler: Listener) {
      this.handlers.set(event, handler);
    }
    loadSource(src: string) {
      this.calls.push(`loadSource:${src}`);
    }
    attachMedia() {
      this.calls.push("attachMedia");
    }
    startLoad(position: number) {
      this.calls.push(`startLoad:${position}`);
    }
    stopLoad() {
      this.calls.push("stopLoad");
    }
    destroy() {
      this.calls.push("destroy");
    }
    fire(event: string, data: unknown) {
      this.handlers.get(event)?.(event, data);
    }
  }
  return { HlsClass: FakeHls as unknown as typeof Hls, instances };
}

export const HLS: TrailerPreviewStream = {
  src: "http://serveur:3001/api/trailers/hls/FFUGtw7uzB4/master.m3u8?t=abc",
  mimeType: "application/vnd.apple.mpegurl",
  kind: "hls",
  heights: [1080, 720],
};
export const MP4: TrailerPreviewStream = { src: "http://serveur:3001/api/trailers/file/abcdefghijk.mp4?t=abc", mimeType: "video/mp4", kind: "mp4", heights: [] };

export const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
