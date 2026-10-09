import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * La fenêtre PiP n'est ouverte que si la page l'a ANNONCÉE juste avant — et
 * une seule fois. Le filtre `window.open` est le seul endroit où une page peut
 * faire naître une fenêtre : un document de greffon, dans le même webContents
 * mais sans accès aux commandes, ne doit pas pouvoir y glisser la sienne.
 */

vi.mock("electron", () => ({ app: { getAppPath: () => "/x", isPackaged: false }, shell: {}, session: {} }));
vi.mock("../appIcon", () => ({ windowIconPath: () => null }));

import { PIP_CAPTIONS } from "./pipCaptions";
import { PIP_FRAME_NAME, armPip, closePip, pipWindowOpen } from "./pipWindow";

const asked = (frameName: string, url = "about:blank") => ({ frameName, url }) as Electron.HandlerDetails;

beforeEach(() => {
  vi.useRealTimers();
  closePip();
});

describe("pipWindowOpen", () => {
  it("ne regarde que la fenêtre nommée — le reste suit le filtre ordinaire", () => {
    armPip("floating", 480, 270);
    expect(pipWindowOpen(asked("_blank", "https://example.org"))).toBeNull();
  });

  it("refuse une fenêtre PiP que la page n'a pas annoncée", () => {
    expect(pipWindowOpen(asked(PIP_FRAME_NAME))).toEqual({ action: "deny" });
  });

  it("accepte l'annoncée UNE fois, transparente, sans cadre, sous le titre de la colle", () => {
    armPip("floating", 480, 270);
    const response = pipWindowOpen(asked(PIP_FRAME_NAME));
    expect(response?.action).toBe("allow");
    const options = response?.action === "allow" ? response.overrideBrowserWindowOptions : undefined;
    expect(options).toMatchObject({
      width: 480,
      height: 270,
      title: PIP_CAPTIONS.floating,
      transparent: true,
      frame: false,
      skipTaskbar: true,
      show: false,
    });
    // L'annonce est consommée : une seconde ouverture est refusée.
    expect(pipWindowOpen(asked(PIP_FRAME_NAME))).toEqual({ action: "deny" });
  });

  it("le mode ancré prend son titre — c'est lui que la colle lit", () => {
    armPip("docked", 358, 201);
    const response = pipWindowOpen(asked(PIP_FRAME_NAME));
    const options = response?.action === "allow" ? response.overrideBrowserWindowOptions : undefined;
    expect(options?.title).toBe(PIP_CAPTIONS.docked);
    expect(options?.alwaysOnTop).toBe(false);
  });

  it("refuse une autre adresse qu'about:blank, et une annonce périmée", () => {
    armPip("floating", 480, 270);
    expect(pipWindowOpen(asked(PIP_FRAME_NAME, "https://evil.example"))).toEqual({ action: "deny" });
    vi.useFakeTimers();
    armPip("floating", 480, 270);
    vi.advanceTimersByTime(5000);
    expect(pipWindowOpen(asked(PIP_FRAME_NAME))).toEqual({ action: "deny" });
  });
});
