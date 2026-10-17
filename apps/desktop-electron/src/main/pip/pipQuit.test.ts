import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Quitter pendant le PiP, dans l'ordre d'Electron : la fenêtre principale se
 * ferme la première (Cmd+Q, la croix). Le PiP doit rendre la vidéo à une page
 * ENCORE VIVANTE — c'est la fermeture d'après, sur une fenêtre détruite, qui
 * ouvrait la boîte « Object has been destroyed » du bureau 1.30.0.
 */

const host = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("electron", () => ({
  app: { getAppPath: () => "/x", isPackaged: false },
  shell: {},
  session: {},
  BrowserWindow: { fromWebContents: () => host.current },
}));
vi.mock("../appIcon", () => ({ windowIconPath: () => null }));
vi.mock("../security", () => ({ lockNavigation: () => undefined }));
vi.mock("./pipShell", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./pipShell")>()),
  shellDrivesPip: () => false,
  reducedMotion: () => true,
}));

import { onPipWindowChange } from "./pipHost";
import { closePipBeforeHost } from "./pipQuit";
import {
  PIP_FRAME_NAME,
  armPip,
  closePip,
  installPipWindow,
  pipWindowOpen,
} from "./pipWindow";

/** Une fenêtre d'Electron réduite à sa fermeture : `close`, retenue ou non, puis `closed`. */
class FakeWindow extends EventEmitter {
  private destroyed = false;
  readonly webContents = new EventEmitter();
  isDestroyed = (): boolean => this.destroyed;
  isFocused = (): boolean => false;
  getTitle = (): string => "PiP";
  setTitle = (): void => undefined;
  showInactive = (): void => undefined;
  setBackgroundColor = (): void => undefined;
  close(): void {
    if (this.destroyed) return;
    const event = {
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
    };
    this.emit("close", event);
    if (!event.defaultPrevented) this.destroy();
  }
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.emit("closed");
  }
}

/** La fenêtre principale telle que `window.ts` et `index.ts` la montent, PiP ouvert. */
function openWithPip(guard?: (event: { preventDefault: () => void }) => void) {
  const main = new FakeWindow();
  host.current = main;
  main.on("closed", () => closePip()); // `window.ts` : le filet
  if (guard !== undefined) main.on("close", guard); // `quitGuard.ts`, posé avant
  closePipBeforeHost(main);
  installPipWindow(main.webContents as never);
  armPip("floating", 480, 270);
  expect(
    pipWindowOpen({
      frameName: PIP_FRAME_NAME,
      url: "about:blank",
    } as Electron.HandlerDetails)?.action,
  ).toBe("allow");
  const pip = new FakeWindow();
  main.webContents.emit("did-create-window", pip, {
    frameName: PIP_FRAME_NAME,
  });
  // Ce que voit la surface vidéo (`macosPipParent.ts`, `videoWindow.ts`).
  const seen: Array<{ pip: boolean; hostDestroyed: boolean }> = [];
  const unsubscribe = onPipWindowChange((window) =>
    seen.push({ pip: window !== null, hostDestroyed: main.isDestroyed() }),
  );
  return { main, pip, seen, unsubscribe };
}

let cleanup: (() => void) | null = null;
afterEach(() => {
  cleanup?.();
  cleanup = null;
  closePip();
});

describe("quitter pendant le PiP", () => {
  it("ferme le PiP AVANT la fenêtre principale : la vidéo revient à une page vivante", () => {
    const { main, pip, seen, unsubscribe } = openWithPip();
    cleanup = unsubscribe;
    main.close();
    expect(pip.isDestroyed()).toBe(true);
    expect(main.isDestroyed()).toBe(true);
    expect(seen).toEqual([{ pip: false, hostDestroyed: false }]);
  });

  it("une fermeture retenue (téléchargement en cours) laisse le PiP ouvert", () => {
    const { main, pip, seen, unsubscribe } = openWithPip((event) =>
      event.preventDefault(),
    );
    cleanup = unsubscribe;
    main.close();
    expect(main.isDestroyed()).toBe(false);
    expect(pip.isDestroyed()).toBe(false);
    expect(seen).toEqual([]);
  });

  it("`destroy()` sans `close` (séquence de Linux) : le filet de `closed` ferme le PiP après coup", () => {
    const { main, pip, seen, unsubscribe } = openWithPip();
    cleanup = unsubscribe;
    main.destroy();
    expect(pip.isDestroyed()).toBe(true);
    // La fenêtre principale est déjà détruite : c'est le cas que les surfaces
    // doivent supporter sans la toucher (`macosSurface.test.ts`).
    expect(seen).toEqual([{ pip: false, hostDestroyed: true }]);
  });
});
