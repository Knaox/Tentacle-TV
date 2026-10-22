import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Linux : `setFullScreen` est ASYNCHRONE — la fenêtre ne change d'état qu'à
 * l'acquittement du compositeur. Le faux ci-dessous ne bouge qu'à `settle()`,
 * comme Mutter ou KWin, et ne connaît pas `isSimpleFullScreen` (macOS seul).
 */

vi.mock("electron", () => ({
  app: { isPackaged: false },
  screen: { getDisplayMatching: () => ({ bounds: { x: 0, y: 0, width: 1920, height: 1080 } }) },
}));

const realPlatform = process.platform;

function lateWindow() {
  let fullscreen = false;
  let pending: boolean | null = null;
  return {
    setFullScreen: vi.fn((value: boolean) => {
      pending = value;
    }),
    focus: vi.fn(),
    isFullScreen: () => fullscreen,
    isDestroyed: () => false,
    /** Le compositeur répond : l'état change, l'évènement part. */
    settle(): boolean | null {
      if (pending === null) return null;
      fullscreen = pending;
      pending = null;
      return fullscreen;
    },
  };
}

async function loadLinux() {
  Object.defineProperty(process, "platform", { value: "linux", configurable: true });
  vi.resetModules();
  return import("./fullscreen");
}

afterEach(() => {
  Object.defineProperty(process, "platform", { value: realPlatform, configurable: true });
});

describe("Linux — la bascule ne se fie pas à une fenêtre pas encore acquittée", () => {
  it("un second clic rapide SORT, au lieu de redemander l'entrée", async () => {
    const fs = await loadLinux();
    const win = lateWindow();

    expect(fs.toggle(win as never)).toBe(true);
    // Le compositeur n'a pas encore répondu : la fenêtre dit toujours « non ».
    expect(win.isFullScreen()).toBe(false);
    expect(fs.toggle(win as never)).toBe(false);
    expect(win.setFullScreen).toHaveBeenLastCalledWith(false);
  });

  it("l'état demandé fait foi jusqu'à l'évènement, puis la fenêtre", async () => {
    const fs = await loadLinux();
    const win = lateWindow();

    fs.toggle(win as never);
    expect(fs.isFullscreen()).toBe(true);
    fs.noteFullscreenReached(win.settle() ?? false);
    expect(fs.isFullscreen()).toBe(true);

    expect(fs.toggle(win as never)).toBe(false);
    expect(fs.isFullscreen()).toBe(false);
    fs.noteFullscreenReached(win.settle() ?? true);
    expect(fs.isFullscreen()).toBe(false);
  });

  it("ne demande jamais `isSimpleFullScreen`, absent hors macOS", async () => {
    const fs = await loadLinux();
    const win = lateWindow();

    expect(() => fs.toggle(win as never)).not.toThrow();
    fs.noteFullscreenReached(win.settle() ?? false);
    expect(() => fs.toggle(win as never)).not.toThrow();
    expect(() => fs.leave(win as never)).not.toThrow();
  });
});

describe("Linux — montage Wayland forcé, vidéo attachée", () => {
  it("la sortie n'est pas tentée : plus d'éclair, l'état reste « plein écran »", async () => {
    const fs = await loadLinux();
    const { setFullscreenPinned } = await import("./linux/fullscreenPin");
    const win = lateWindow();
    fs.toggle(win as never);
    fs.noteFullscreenReached(win.settle() ?? false);
    win.setFullScreen.mockClear();

    setFullscreenPinned(true);
    expect(fs.toggle(win as never)).toBe(true);
    expect(win.setFullScreen).not.toHaveBeenCalled();
    setFullscreenPinned(false);
  });
});
