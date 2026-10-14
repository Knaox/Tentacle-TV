/**
 * La source d'un aperçu, suite : la qualité de la BOÎTE (départ et plafond),
 * le tampon d'avance réduit au premier segment avant la révélation, et le
 * premier fragment VIDÉO qui dit que le flux coule (la révélation sur l'image
 * du titre l'attend).
 */
import { describe, expect, it, vi } from "vitest";
import { attachPreviewSource } from "./previewSource";
import { EVENTS, FakeVideo, HLS, MP4, fakeHlsClass, flush } from "./previewSourceTestKit";

describe("attachPreviewSource — la boîte, le tampon, le flux qui coule", () => {
  it("départ ET plafond au plus petit niveau qui couvre la boîte ; avant la révélation, le premier segment seulement", async () => {
    vi.stubGlobal("window", { devicePixelRatio: 2 });
    const video = Object.assign(new FakeVideo(), { clientWidth: 560, clientHeight: 315 });
    const { HlsClass, instances } = fakeHlsClass();
    const session = attachPreviewSource(video as never, HLS, { onReady: vi.fn(), onError: vi.fn() }, async () => HlsClass);
    await flush();
    const hls = instances[0];
    const sizes = [[256, 144], [640, 360], [1280, 720], [1920, 1080]].map(([width, height]) => ({ width, height, bitrate: height }));
    hls.fire(EVENTS.MANIFEST_PARSED, { levels: sizes });
    expect([hls.startLevelValue, hls.autoLevelCapping]).toEqual([2, 2]);
    expect(hls.config).toMatchObject({ maxBufferLength: 1, maxMaxBufferLength: 1 });
    session.unleash();
    expect(hls.config).toMatchObject({ maxBufferLength: 12, maxMaxBufferLength: 15 });
    // Rognée de son letterbox (×1,6), la vidéo s'affiche plus grande : le plafond monte d'un niveau.
    hls.levels = sizes;
    session.setCrop(1.6);
    expect(hls.autoLevelCapping).toBe(3);
    vi.unstubAllGlobals();
  });

  it("le flux COULE au premier fragment vidéo (jamais un fragment audio), une fois ; en lecture native, aux premières images en tampon", async () => {
    const { HlsClass, instances } = fakeHlsClass();
    const onFragment = vi.fn();
    attachPreviewSource(new FakeVideo() as never, HLS, { onReady: vi.fn(), onError: vi.fn(), onFragment }, async () => HlsClass);
    await flush();
    instances[0].fire(EVENTS.FRAG_LOADED, { frag: { type: "audio" } });
    expect(onFragment).not.toHaveBeenCalled();
    instances[0].fire(EVENTS.FRAG_LOADED, { frag: { type: "main" } });
    instances[0].fire(EVENTS.FRAG_LOADED, { frag: { type: "main" } });
    expect(onFragment).toHaveBeenCalledTimes(1);
    const native = Object.assign(new FakeVideo(), { buffered: { length: 0 } });
    const nativeFragment = vi.fn();
    attachPreviewSource(native as never, MP4, { onReady: vi.fn(), onError: vi.fn(), onFragment: nativeFragment });
    native.emit("progress");
    expect(nativeFragment).not.toHaveBeenCalled();
    native.buffered.length = 1;
    native.emit("progress");
    expect(nativeFragment).toHaveBeenCalledTimes(1);
  });
});
