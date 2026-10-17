import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";

/**
 * Le PiP se ferme APRÈS la fenêtre principale (destruction sans `close`) : la
 * surface ne doit ni lever, ni écrire à la `NSWindow` libérée de la page. La
 * trace du bureau 1.30.0 : `moveTo` → `geometrie` → `videoTarget` sur une
 * `BrowserWindow` détruite, « Object has been destroyed ».
 */

/** Les `NSWindow` par leur nom : `page`, `pip`, `mpv`. Tout message est relevé. */
const native = vi.hoisted(() => {
  const calls: Array<{ selector: string; window: unknown }> = [];
  const rect = { x: 0, y: 0, width: 800, height: 450 };
  const msg = new Proxy(
    {},
    {
      get:
        (_target, name: string) =>
        (window: unknown, ...rest: unknown[]) => {
          calls.push({ selector: name, window });
          if (name === "get") return window;
          if (name === "rect" || name === "contentRect") return rect;
          if (name === "int") return 0;
          if (name === "bool") return false;
          return rest[0];
        },
    },
  );
  return { calls, msg };
});

// Comme sur le runner Linux de quality.yml, sur TOUT poste : aucune
// bibliothèque native ne se charge. Un module qui appelle encore `koffi.load` à
// son import fait échouer ce test sur le Mac aussi, pas seulement en CI.
vi.mock("koffi", () => ({
  default: {
    load: () => {
      throw new Error("Failed to load shared library");
    },
  },
}));
// La seule dépendance de `macosChildWindow.ts` qui charge le runtime Objective-C.
vi.mock("./macosFrameConstraint", () => ({
  releaseMpvFrameConstraint: () => undefined,
}));
vi.mock("./objc", () => ({
  msg: native.msg,
  fromHandle: (handle: unknown) => handle,
  NSWindowBelow: -1,
}));
vi.mock("./native", () => ({
  trace: () => undefined,
  neverThrow: (_what: string, action: () => void) => action(),
}));
vi.mock("./macosWindowWatch", () => ({
  mpvLeftovers: () => new Set(),
  windowGone: () => false,
  watchMpvWindow: (
    _leftovers: unknown,
    found: (window: unknown, number: number) => void,
  ) => {
    found("mpv", 7);
    return () => undefined;
  },
}));
vi.mock("./macosChildWindow", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./macosChildWindow")>()),
  attachBelowPage: (parent: unknown, window: unknown) =>
    native.calls.push({
      selector: "attachBelowPage",
      window: parent ?? window,
    }),
}));
vi.mock("./macosSeam", () => ({
  SETTLE_MS: 500,
  createSeam: () => ({ schedule: () => undefined, forget: () => undefined }),
}));
vi.mock("./macosEdr", () => ({
  watchEdr: () => undefined,
  forgetEdr: () => undefined,
}));
vi.mock("./macosSurfaceDiag", () => ({
  describeMontage: () => "",
  stateAtDiscovery: () => "",
}));
vi.mock("./macosAlignClock", () => ({
  AlignClock: class {
    schedule(): void {}
    watch(): void {}
    stop(): void {}
    stopWatch(): void {}
  },
}));
vi.mock("../window", () => ({ setPlayerSurfaceTransparent: () => undefined }));
vi.mock("../macosTitleBar", () => ({ bannerInset: () => 0 }));

import { setPipWindow } from "../pip/pipHost";
import { MacosSurface } from "./macosSurface";

/** Ce que la surface lit d'une `BrowserWindow` — et qui lève, une fois détruite, comme Electron. */
class FakeWindow extends EventEmitter {
  destroyed = false;
  constructor(private readonly ns: string) {
    super();
  }
  private alive<T>(value: T): T {
    if (this.destroyed) throw new TypeError("Object has been destroyed");
    return value;
  }
  isDestroyed = (): boolean => this.destroyed;
  getNativeWindowHandle = (): string => this.alive(this.ns);
  getBounds = () => this.alive({ x: 0, y: 0, width: 800, height: 450 });
  getContentBounds = () => this.alive({ x: 0, y: 0, width: 800, height: 450 });
  isFullScreen = (): boolean => this.alive(false);
  isSimpleFullScreen = (): boolean => this.alive(false);
}

describe("MacosSurface — PiP fermé après la fenêtre principale", () => {
  it("ne lève pas, et la vidéo quitte l'écran et le PiP sans un mot à la page libérée", () => {
    const page = new FakeWindow("page");
    const pip = new FakeWindow("pip");
    const surface = new MacosSurface(page as never);
    surface.attach();
    setPipWindow(pip as never);
    expect(native.calls).toContainEqual({
      selector: "addChildWindow",
      window: "pip",
    });

    // Cmd+Q, ancien ordre : la page part d'abord, puis le PiP se ferme.
    page.destroyed = true;
    native.calls.length = 0;
    expect(() => setPipWindow(null)).not.toThrow();
    expect(native.calls).toEqual([
      { selector: "orderOut", window: "mpv" },
      { selector: "removeChildWindow", window: "pip" },
    ]);

    // L'arrêt de mpv détache ensuite : rien vers la page libérée non plus.
    native.calls.length = 0;
    expect(() => surface.detach()).not.toThrow();
    expect(native.calls.some((call) => call.window === "page")).toBe(false);
    expect(surface.geometrie()).toBe("surface non attachee");
  });
});
