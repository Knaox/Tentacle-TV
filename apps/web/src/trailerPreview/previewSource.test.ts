/**
 * La source d'un aperçu sur son `<video>`, avec un faux hls.js : chargée en
 * pause jusqu'à la première image, départ au niveau de la BOÎTE (le plus haut
 * sans dimensions connues), toute erreur fatale remontée, et rien qui
 * consomme encore après la sortie.
 */
import { describe, expect, it, vi } from "vitest";
import { attachPreviewSource, keepsStartOffset, previewHlsConfig, topLevel } from "./previewSource";
import { EVENTS, FakeVideo, HLS, MP4, fakeHlsClass, flush } from "./previewSourceTestKit";

describe("attachPreviewSource — HLS par hls.js", () => {
  it("pose le maître, part du niveau le plus haut, en muet et sans lecture", async () => {
    const video = new FakeVideo();
    const { HlsClass, instances } = fakeHlsClass();
    attachPreviewSource(video as never, HLS, { onReady: vi.fn(), onError: vi.fn() }, async () => HlsClass);
    await flush();
    const hls = instances[0];
    expect(video.muted).toBe(true);
    expect(video.preload).toBe("auto");
    expect(hls.calls).toEqual([`loadSource:${HLS.src}`, "attachMedia"]);
    expect(hls.config).toMatchObject({ autoStartLoad: false, capLevelToPlayerSize: false, testBandwidth: false });
    hls.fire(EVENTS.MANIFEST_PARSED, { levels: [{ height: 360, bitrate: 1 }, { height: 1080, bitrate: 5 }, { height: 720, bitrate: 3 }] });
    expect(hls.startLevelValue).toBe(1);
    // Départ quelques secondes plus loin que le noir ou le logo du distributeur.
    expect(hls.calls).toContain("startLoad:4");
    expect(video.calls).not.toContain("play");
  });

  it("départ décalé gardé dans le premier segment d'une vidéo assez longue, sinon départ à 0", async () => {
    const segments = (first: number) => [{ duration: first }, { duration: 5 }];
    const { HlsClass, instances } = fakeHlsClass();
    attachPreviewSource(new FakeVideo() as never, HLS, { onReady: vi.fn(), onError: vi.fn() }, async () => HlsClass);
    attachPreviewSource(new FakeVideo() as never, HLS, { onReady: vi.fn(), onError: vi.fn() }, async () => HlsClass);
    await flush();
    const [long, short] = instances;
    long.fire(EVENTS.MANIFEST_PARSED, { levels: [{ height: 1080, bitrate: 5 }] });
    long.fire(EVENTS.LEVEL_LOADED, { details: { totalduration: 138, fragments: segments(5.48) } });
    expect(long.calls).not.toContain("stopLoad");
    short.fire(EVENTS.MANIFEST_PARSED, { levels: [{ height: 1080, bitrate: 5 }] });
    short.fire(EVENTS.LEVEL_LOADED, { details: { totalduration: 20, fragments: segments(5.48) } });
    expect(short.calls.slice(-2)).toEqual(["stopLoad", "startLoad:0"]);
    // Une seule fois : les listes suivantes (changement de niveau) ne redécident rien.
    short.fire(EVENTS.LEVEL_LOADED, { details: { totalduration: 20, fragments: segments(5.48) } });
    expect(short.calls.filter((c) => c === "stopLoad")).toHaveLength(1);
  });

  it("le décalage ne vaut que dans le premier segment, avec une marge, et pour 30 s au moins", () => {
    expect(keepsStartOffset({ totalduration: 138, fragments: [{ duration: 5.04 }] } as never)).toBe(true);
    expect(keepsStartOffset({ totalduration: 138, fragments: [{ duration: 4.2 }] } as never)).toBe(false);
    expect(keepsStartOffset({ totalduration: 29, fragments: [{ duration: 6 }] } as never)).toBe(false);
    expect(keepsStartOffset({ totalduration: 138, fragments: [] } as never)).toBe(false);
  });

  it("prête deux images d'animation après la première image décodée, sinon au repli", async () => {
    vi.useFakeTimers();
    const frames: Array<() => void> = [];
    vi.stubGlobal("requestAnimationFrame", (callback: () => void) => frames.push(callback));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    try {
      const video = new FakeVideo();
      const onReady = vi.fn();
      attachPreviewSource(video as never, HLS, { onReady, onError: vi.fn() }, async () => fakeHlsClass().HlsClass);
      video.emit("loadeddata");
      frames.shift()?.();
      expect(onReady).not.toHaveBeenCalled();
      frames.shift()?.();
      expect(onReady).toHaveBeenCalledTimes(1);
      // Le repli ne la redit pas.
      vi.advanceTimersByTime(200);
      expect(onReady).toHaveBeenCalledTimes(1);

      // Images d'animation bridées (page en arrière-plan) : le repli, à 100 ms.
      const throttled = new FakeVideo();
      const onThrottledReady = vi.fn();
      attachPreviewSource(throttled as never, HLS, { onReady: onThrottledReady, onError: vi.fn() }, async () => fakeHlsClass().HlsClass);
      throttled.emit("loadeddata");
      vi.advanceTimersByTime(99);
      expect(onThrottledReady).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(onThrottledReady).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });

  it("une erreur fatale remonte, une erreur passagère non", async () => {
    const video = new FakeVideo();
    const { HlsClass, instances } = fakeHlsClass();
    const onError = vi.fn();
    attachPreviewSource(video as never, HLS, { onReady: vi.fn(), onError }, async () => HlsClass);
    await flush();
    instances[0].fire(EVENTS.ERROR, { fatal: false, details: "fragLoadTimeOut" });
    expect(onError).not.toHaveBeenCalled();
    instances[0].fire(EVENTS.ERROR, { fatal: true, details: "manifestLoadError" });
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("à la sortie : hls.js détruit, l'élément vidé, plus aucun rappel", async () => {
    const frames: Array<() => void> = [];
    const cancelFrame = vi.fn();
    vi.stubGlobal("requestAnimationFrame", (callback: () => void) => frames.push(callback));
    vi.stubGlobal("cancelAnimationFrame", cancelFrame);
    try {
      const video = new FakeVideo();
      const { HlsClass, instances } = fakeHlsClass();
      const onReady = vi.fn();
      const session = attachPreviewSource(video as never, HLS, { onReady, onError: vi.fn() }, async () => HlsClass);
      await flush();
      video.emit("loadeddata");
      session.release();
      expect(instances[0].calls).toContain("destroy");
      expect(cancelFrame).toHaveBeenCalled();
      expect(video.calls).toEqual(expect.arrayContaining(["pause", "removeAttribute:src", "load"]));
      frames.splice(0).forEach((frame) => frame());
      frames.splice(0).forEach((frame) => frame());
      video.emit("loadeddata");
      expect(onReady).not.toHaveBeenCalled();
      expect([...video.listeners.values()].every((set) => set.size === 0)).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("une sortie avant le chargement de hls.js ne crée rien", async () => {
    const video = new FakeVideo();
    const { HlsClass, instances } = fakeHlsClass();
    const session = attachPreviewSource(video as never, HLS, { onReady: vi.fn(), onError: vi.fn() }, async () => HlsClass);
    session.release();
    await flush();
    expect(instances).toHaveLength(0);
  });

  it("sans MSE : le navigateur lit le HLS seul s'il sait, sinon échec", async () => {
    const native = new FakeVideo("application/vnd.apple.mpegurl");
    attachPreviewSource(native as never, HLS, { onReady: vi.fn(), onError: vi.fn() }, async () => fakeHlsClass(false).HlsClass);
    await flush();
    expect(native.src).toBe(HLS.src);

    const none = new FakeVideo();
    const onError = vi.fn();
    attachPreviewSource(none as never, HLS, { onReady: vi.fn(), onError }, async () => fakeHlsClass(false).HlsClass);
    await flush();
    expect(onError).toHaveBeenCalledTimes(1);
  });
});

describe("attachPreviewSource — MP4", () => {
  it("le fichier se pose sur l'élément, sans hls.js", async () => {
    const video = new FakeVideo();
    const loadHls = vi.fn();
    attachPreviewSource(video as never, MP4, { onReady: vi.fn(), onError: vi.fn() }, loadHls);
    expect(video.src).toBe(MP4.src);
    expect(video.calls).toContain("load");
    expect(loadHls).not.toHaveBeenCalled();
  });

  it("une erreur de l'élément remonte", () => {
    const video = new FakeVideo();
    const onError = vi.fn();
    attachPreviewSource(video as never, MP4, { onReady: vi.fn(), onError }, vi.fn());
    video.emit("error");
    expect(onError).toHaveBeenCalledTimes(1);
  });
});

describe("la meilleure qualité possible", () => {
  it("le plus haut niveau : la hauteur d'abord, puis le débit", () => {
    expect(topLevel([{ height: 720, bitrate: 3 }, { height: 1080, bitrate: 4 }, { height: 1080, bitrate: 6 }])).toBe(2);
    expect(topLevel([])).toBe(-1);
  });

  it("aucun plafond à la taille de la mini-carte ni à la cadence", () => {
    expect(previewHlsConfig()).toMatchObject({ capLevelToPlayerSize: false, capLevelOnFPSDrop: false });
  });
});
