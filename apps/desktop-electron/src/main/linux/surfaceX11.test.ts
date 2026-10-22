/**
 * SurfaceX11 — l'activation rendue à notre fenêtre quand le gestionnaire la
 * donne à mpv au mappage.
 *
 * Xlib est mocké (`./x11`) : le banc dit QUELLE fenêtre est active, la surface
 * décide de reprendre la main ou non. Le gestionnaire réel (openbox active mpv,
 * xfwm4 non) est l'affaire du banc X11 hors dépôt.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  found: null as bigint | null,
  active: 0n,
}));
vi.mock("electron", () => ({
  screen: { getDisplayMatching: () => ({ scaleFactor: 1 }) },
}));
vi.mock("./x11", () => ({
  x11Display: () => ({}),
  x11WindowNumber: () => 0x600004n,
  moveBelow: vi.fn(),
  setRectangle: vi.fn(),
  sync: vi.fn(),
  findMpvWindow: () => h.found,
  iconify: vi.fn(),
  deiconify: vi.fn(),
  activeWindow: () => h.active,
}));

import { SurfaceX11 } from "./surfaceX11";

const MPV = 0x1200002n;

function host() {
  return {
    isDestroyed: () => false,
    isMinimized: () => false,
    focus: vi.fn(),
    getNativeWindowHandle: () => Buffer.alloc(4),
    getContentBounds: () => ({ x: 100, y: 100, width: 900, height: 600 }),
    on: vi.fn(),
    off: vi.fn(),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  h.found = null;
  h.active = 0n;
});
afterEach(() => vi.useRealTimers());

describe("SurfaceX11 — activation au mappage de mpv", () => {
  it("reprend le focus quand le gestionnaire a activé mpv AVANT que le sondage la trouve", () => {
    const win = host();
    const surface = new SurfaceX11(win as never);
    surface.attach();
    // mpv est mappée et activée : notre `blur` est passé, sans vidéo connue.
    h.found = MPV;
    h.active = MPV;
    vi.advanceTimersByTime(100); // le sondage la trouve
    vi.advanceTimersByTime(200); // le contrôle d'activation
    expect(win.focus).toHaveBeenCalledTimes(1);
    surface.detach();
  });

  it("ne prend rien à une autre application", () => {
    const win = host();
    const surface = new SurfaceX11(win as never);
    surface.attach();
    h.found = MPV;
    h.active = 0x4200001n; // une autre fenêtre est active
    vi.advanceTimersByTime(400);
    expect(win.focus).not.toHaveBeenCalled();
    surface.detach();
  });
});
