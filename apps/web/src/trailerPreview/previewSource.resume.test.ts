/**
 * Le retour sur une carte : la bande-annonce reprend où on l'avait quittée
 * (`previewPositions.ts`), au lieu de repartir de son début. La position est
 * retenue par VIDÉO (le chemin sans jeton), dix minutes ; une bande-annonce
 * finie, ou jamais lancée, repart du début.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attachPreviewSource } from "./previewSource";
import { clearPreviewPositions, rememberPosition, resumePositionFor } from "./previewPositions";
import { EVENTS, FakeVideo, HLS, MP4, fakeHlsClass, flush } from "./previewSourceTestKit";

const LEVELS = { levels: [{ height: 1080, bitrate: 5 }] };

/** Une session montrée (première image, lecture), quittée à `at` secondes. */
async function watchAndLeave(src = HLS, at = 37, extra: Record<string, unknown> = {}) {
  const video = new FakeVideo();
  const { HlsClass } = fakeHlsClass();
  const session = attachPreviewSource(video as never, src, { onReady: vi.fn(), onError: vi.fn() }, async () => HlsClass);
  await flush();
  video.emit("loadeddata");
  vi.advanceTimersByTime(100);
  video.emit("playing");
  Object.assign(video, { currentTime: at, duration: 138, ended: false, ...extra });
  session.release();
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  vi.stubGlobal("requestAnimationFrame", undefined);
  clearPreviewPositions();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const flushTimers = async () => {
  const done = flush();
  vi.advanceTimersByTime(0);
  await done;
};

describe("aperçu › la reprise au retour sur la carte", () => {
  it("HLS : le retour repart de la position quittée, sans revenir à 0", async () => {
    const leaving = watchAndLeave();
    vi.advanceTimersByTime(0);
    await leaving;
    expect(resumePositionFor(HLS.src)).toBe(37);

    const { HlsClass, instances } = fakeHlsClass();
    attachPreviewSource(new FakeVideo() as never, HLS, { onReady: vi.fn(), onError: vi.fn() }, async () => HlsClass);
    await flushTimers();
    const hls = instances[0];
    hls.fire(EVENTS.MANIFEST_PARSED, LEVELS);
    expect(hls.calls).toContain("startLoad:37");
    // Vidéo courte ou pas : une reprise ne retombe jamais au début.
    hls.fire(EVENTS.LEVEL_LOADED, { details: { totalduration: 20, fragments: [{ duration: 5.48 }] } });
    expect(hls.calls).not.toContain("stopLoad");
  });

  it("un autre jeton, la même vidéo : reprise ; une autre vidéo : départ décalé ordinaire", async () => {
    const leaving = watchAndLeave();
    vi.advanceTimersByTime(0);
    await leaving;
    expect(resumePositionFor(HLS.src.replace("t=abc", "t=neuf"))).toBe(37);
    expect(resumePositionFor(HLS.src.replace("FFUGtw7uzB4", "autreVideo1"))).toBeNull();
  });

  it("dix minutes au plus", async () => {
    const leaving = watchAndLeave();
    vi.advanceTimersByTime(0);
    await leaving;
    vi.setSystemTime(Date.now() + 10 * 60 * 1000 + 1);
    expect(resumePositionFor(HLS.src)).toBeNull();
  });

  it("jamais lancée, finie, ou quittée près de la fin : départ du début", async () => {
    // Montrée mais jamais lue : rien.
    const video = new FakeVideo();
    const session = attachPreviewSource(video as never, HLS, { onReady: vi.fn(), onError: vi.fn() }, async () => fakeHlsClass().HlsClass);
    Object.assign(video, { currentTime: 4, duration: 138, ended: false });
    session.release();
    expect(resumePositionFor(HLS.src)).toBeNull();

    const nearEnd = watchAndLeave(HLS, 137);
    vi.advanceTimersByTime(0);
    await nearEnd;
    expect(resumePositionFor(HLS.src)).toBeNull();

    rememberPosition(HLS.src, 50, 138);
    const ended = new FakeVideo();
    attachPreviewSource(ended as never, HLS, { onReady: vi.fn(), onError: vi.fn() }, async () => fakeHlsClass().HlsClass);
    ended.emit("ended");
    expect(resumePositionFor(HLS.src)).toBeNull();
  });

  it("MP4 : la reprise se pose dès que la durée est connue", async () => {
    rememberPosition(MP4.src, 22, 90);
    const video = new FakeVideo();
    attachPreviewSource(video as never, MP4, { onReady: vi.fn(), onError: vi.fn() });
    video.emit("loadedmetadata");
    expect((video as unknown as { currentTime: number }).currentTime).toBe(22);
  });
});
