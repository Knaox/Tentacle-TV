import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTrailerWatch } from "./useTrailerWatch";

// React sans DOM, comme les bancs de l'aperçu (`trailerPreview/previewTestRig.ts`).
const g = globalThis as Record<string, unknown>;
g.IS_REACT_ACT_ENVIRONMENT = true;
g.window ??= globalThis;
const doc: Record<string, unknown> = { nodeType: 9, activeElement: null, addEventListener() {}, removeEventListener() {} };
doc.defaultView = { document: doc, HTMLIFrameElement: class {} };
const container = () => ({
  nodeType: 1, tagName: "DIV", nodeName: "DIV", namespaceURI: "http://www.w3.org/1999/xhtml",
  ownerDocument: doc, addEventListener() {}, removeEventListener() {},
});

/** Un `<video>` réduit à ce que le chien de garde lit. */
class FakeVideo extends EventTarget {
  currentTime = 0;
  duration = 60;
  paused = false;
  seeking = false;
}

function watch(video: FakeVideo) {
  const callbacks = { onStarted: vi.fn(), onFailed: vi.fn(), onEnded: vi.fn() };
  const ref = { current: video as unknown as HTMLVideoElement };
  const hook = { result: { current: { started: false, waiting: false } } };
  function Probe() {
    hook.result.current = useTrailerWatch(ref, "yt:a|u", callbacks);
    return null;
  }
  act(() => createRoot(container() as never).render(createElement(Probe)));
  return { callbacks, hook };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("chien de garde de la bande-annonce", () => {
  it("aucune image en 15 s : échec", () => {
    const { callbacks } = watch(new FakeVideo());
    act(() => { vi.advanceTimersByTime(16_000); });
    expect(callbacks.onFailed).toHaveBeenCalledWith(expect.stringContaining("aucune image"));
  });

  it("la première image démarre ; un arrêt de 15 s au milieu est un échec, au bout une fin", () => {
    const video = new FakeVideo();
    const { callbacks, hook } = watch(video);
    act(() => { video.dispatchEvent(new Event("playing")); });
    expect(callbacks.onStarted).toHaveBeenCalledTimes(1);
    expect(hook.result.current.started).toBe(true);
    video.currentTime = 10;
    act(() => { vi.advanceTimersByTime(2_000); });
    expect(hook.result.current.waiting).toBe(true);
    act(() => { vi.advanceTimersByTime(15_000); });
    expect(callbacks.onFailed).toHaveBeenCalledWith(expect.stringContaining("arrêtée"));

    const atEnd = new FakeVideo();
    const second = watch(atEnd);
    act(() => { atEnd.dispatchEvent(new Event("playing")); });
    atEnd.currentTime = 59;
    act(() => { vi.advanceTimersByTime(17_000); });
    expect(second.callbacks.onEnded).toHaveBeenCalledTimes(1);
    expect(second.callbacks.onFailed).not.toHaveBeenCalled();
  });

  it("en pause, rien n'est attendu", () => {
    const video = new FakeVideo();
    const { callbacks, hook } = watch(video);
    act(() => { video.dispatchEvent(new Event("playing")); });
    video.paused = true;
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(callbacks.onFailed).not.toHaveBeenCalled();
    expect(hook.result.current.waiting).toBe(false);
  });
});
