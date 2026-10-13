/**
 * La lecture d'un aperçu chargé : avec le son si possible, en muet sans
 * erreur si le navigateur le refuse ; une lecture figée s'arrête ; le volume
 * glisse sans saut.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { rampVolume, startPreviewPlayback, watchPreviewStall, type FrameScheduler } from "./previewPlayback";

type Listener = () => void;

function fakeVideo(play: (video: { muted: boolean }) => Promise<void>) {
  const listeners = new Map<string, Set<Listener>>();
  const video = {
    muted: false,
    volume: 1,
    play: vi.fn(() => play(video)),
    pause: vi.fn(),
    addEventListener: (type: string, listener: Listener) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(listener);
    },
    removeEventListener: (type: string, listener: Listener) => listeners.get(type)?.delete(listener),
    emit: (type: string) => listeners.get(type)?.forEach((listener) => listener()),
    listenerCount: () => [...listeners.values()].reduce((sum, set) => sum + set.size, 0),
  };
  return video;
}

const named = (name: string) => Object.assign(new Error(name), { name });
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  vi.useRealTimers();
});

describe("startPreviewPlayback", () => {
  it("avec le son : le volume part de zéro (le fondu le monte)", async () => {
    const video = fakeVideo(async () => undefined);
    const callbacks = { onSoundBlocked: vi.fn(), onError: vi.fn() };
    startPreviewPlayback(video as never, true, callbacks);
    await flush();
    expect(video.muted).toBe(false);
    expect(video.volume).toBe(0);
    expect(video.play).toHaveBeenCalledTimes(1);
    expect(callbacks.onSoundBlocked).not.toHaveBeenCalled();
  });

  it("son refusé par le navigateur : la lecture repart en muet, sans erreur", async () => {
    const video = fakeVideo(async (v) => {
      if (!v.muted) throw named("NotAllowedError");
    });
    const callbacks = { onSoundBlocked: vi.fn(), onError: vi.fn() };
    startPreviewPlayback(video as never, true, callbacks);
    await flush();
    await flush();
    expect(video.play).toHaveBeenCalledTimes(2);
    expect(video.muted).toBe(true);
    expect(callbacks.onSoundBlocked).toHaveBeenCalledTimes(1);
    expect(callbacks.onError).not.toHaveBeenCalled();
  });

  it("même muette refusée, ou une autre erreur : échec", async () => {
    const video = fakeVideo(async () => {
      throw named("NotAllowedError");
    });
    const callbacks = { onSoundBlocked: vi.fn(), onError: vi.fn() };
    startPreviewPlayback(video as never, true, callbacks);
    await flush();
    await flush();
    expect(callbacks.onError).toHaveBeenCalledTimes(1);

    const broken = fakeVideo(async () => {
      throw named("NotSupportedError");
    });
    const brokenCallbacks = { onSoundBlocked: vi.fn(), onError: vi.fn() };
    startPreviewPlayback(broken as never, false, brokenCallbacks);
    await flush();
    expect(brokenCallbacks.onError).toHaveBeenCalledTimes(1);
  });

  it("une lecture interrompue (pause, sortie) n'est pas une erreur ; annulée, la réponse tardive ne fait rien", async () => {
    const aborted = fakeVideo(async () => {
      throw named("AbortError");
    });
    const callbacks = { onSoundBlocked: vi.fn(), onError: vi.fn() };
    startPreviewPlayback(aborted as never, true, callbacks);
    await flush();
    expect(callbacks.onError).not.toHaveBeenCalled();

    let reject: (error: unknown) => void = () => undefined;
    const late = fakeVideo(() => new Promise((_resolve, rej) => {
      reject = rej;
    }));
    const lateCallbacks = { onSoundBlocked: vi.fn(), onError: vi.fn() };
    const cancel = startPreviewPlayback(late as never, false, lateCallbacks);
    cancel();
    reject(named("NotSupportedError"));
    await flush();
    expect(lateCallbacks.onError).not.toHaveBeenCalled();
  });
});

describe("watchPreviewStall", () => {
  it("une attente plus longue que le délai : échec ; une reprise l'annule", () => {
    vi.useFakeTimers();
    const video = fakeVideo(async () => undefined);
    const onStall = vi.fn();
    const stop = watchPreviewStall(video as never, onStall, 5_000);
    video.emit("waiting");
    vi.advanceTimersByTime(4_000);
    video.emit("playing");
    vi.advanceTimersByTime(10_000);
    expect(onStall).not.toHaveBeenCalled();
    video.emit("waiting");
    vi.advanceTimersByTime(5_000);
    expect(onStall).toHaveBeenCalledTimes(1);
    stop();
    expect(video.listenerCount()).toBe(0);
  });
});

describe("rampVolume", () => {
  function frames() {
    let time = 0;
    const queue: Array<(now: number) => void> = [];
    const scheduler: FrameScheduler = {
      request: (callback) => queue.push(callback),
      cancel: () => {
        queue.length = 0;
      },
      now: () => time,
    };
    const advance = (ms: number) => {
      time += ms;
      const due = queue.splice(0);
      due.forEach((callback) => callback(time));
    };
    return { scheduler, advance };
  }

  it("monte en douceur jusqu'au volume visé, sans le dépasser", () => {
    const { scheduler, advance } = frames();
    const video = { volume: 0 };
    rampVolume(video, 0.6, 400, scheduler);
    advance(100);
    const early = video.volume;
    expect(early).toBeGreaterThan(0);
    expect(early).toBeLessThan(0.6 / 4);
    advance(300);
    expect(video.volume).toBeCloseTo(0.6, 5);
  });

  it("descend jusqu'au silence ; arrêtée, elle ne touche plus au volume", () => {
    const { scheduler, advance } = frames();
    const video = { volume: 0.6 };
    rampVolume(video, 0, 240, scheduler);
    advance(240);
    expect(video.volume).toBe(0);

    const stopped = { volume: 0 };
    const stop = rampVolume(stopped, 0.6, 400, scheduler);
    stop();
    advance(400);
    expect(stopped.volume).toBe(0);
  });
});
