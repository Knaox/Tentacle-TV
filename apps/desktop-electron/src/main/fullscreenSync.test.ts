import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ app: { isPackaged: true } }));
vi.mock("./fullscreen", () => ({
  toggle: vi.fn(),
  isFullscreen: vi.fn(() => false),
  leave: vi.fn(),
  noteFullscreenReached: vi.fn(),
}));

import { fullscreenOnResize, installFullscreenSync } from "./fullscreenSync";

/** Une fenêtre de banc : ses évènements, son drapeau plein écran, ce qu'elle envoie à la page. */
function fakeWindow() {
  const events = new EventEmitter();
  const sent: boolean[] = [];
  const state = { fullscreen: false };
  const win = {
    on: (name: string, listener: () => void) => events.on(name, listener),
    isDestroyed: () => false,
    isFullScreen: () => state.fullscreen,
    webContents: {
      send: (_channel: string, value: boolean) => sent.push(value),
      on: () => undefined,
    },
  };
  return { win, events, sent, state };
}

const realPlatform = process.platform;
afterEach(() => Object.defineProperty(process, "platform", { value: realPlatform }));

describe("fullscreenOnResize — ce qu'un resize diffuse", () => {
  it("l'état de la fenêtre quand il a changé, rien sinon", () => {
    expect(fullscreenOnResize(undefined, false)).toBe(false);
    expect(fullscreenOnResize(false, true)).toBe(true);
    expect(fullscreenOnResize(true, true)).toBeNull();
    expect(fullscreenOnResize(true, false)).toBe(false);
  });
});

describe("macOS — la page apprend le plein écran au DÉBUT de la transition", () => {
  it("diffuse au premier resize où le drapeau d'AppKit change, une seule fois", () => {
    Object.defineProperty(process, "platform", { value: "darwin" });
    const { win, events, sent, state } = fakeWindow();
    installFullscreenSync(win as never);

    // Début de l'entrée : le styleMask porte déjà le plein écran, la vue a sa taille.
    state.fullscreen = true;
    events.emit("resize");
    events.emit("resize");
    expect(sent).toEqual([true]);
    // Fin de l'animation, ~1 s plus tard : la confirmation ne change rien à la page.
    events.emit("enter-full-screen");
    expect(sent).toEqual([true, true]);

    // Sortie : même chose, dès le premier resize.
    state.fullscreen = false;
    events.emit("resize");
    expect(sent).toEqual([true, true, false]);
  });

  it("un redimensionnement fenêtré ne diffuse rien de plus", () => {
    Object.defineProperty(process, "platform", { value: "darwin" });
    const { win, events, sent } = fakeWindow();
    installFullscreenSync(win as never);
    events.emit("resize");
    events.emit("resize");
    expect(sent).toEqual([false]);
  });

  it("hors macOS, le resize ne diffuse rien (Linux a son intention, Windows sa parade)", () => {
    Object.defineProperty(process, "platform", { value: "linux" });
    const { win, events, sent, state } = fakeWindow();
    installFullscreenSync(win as never);
    state.fullscreen = true;
    events.emit("resize");
    expect(sent).toEqual([]);
  });
});
