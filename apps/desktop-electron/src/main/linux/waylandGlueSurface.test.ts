import type { BrowserWindow } from "electron";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * La surface collée : ce qui se garde ici, c'est ce qu'elle NE fait PAS —
 * jamais de plein écran forcé (tout l'objet du montage), et un cycle
 * pose/retrait propre même quand KWin refuse.
 */

const { etatColle } = vi.hoisted(() => ({
  etatColle: { poserRend: true, poses: 0, retraits: 0 },
}));

vi.mock("./kwinGlue", () => ({
  ColleKwin: class {
    poser(): Promise<boolean> {
      etatColle.poses += 1;
      return Promise.resolve(etatColle.poserRend);
    }
    retirer(): Promise<void> {
      etatColle.retraits += 1;
      return Promise.resolve();
    }
  },
}));

import { SurfaceWaylandColle } from "./waylandGlueSurface";

function fauxHote(): { hote: BrowserWindow; setFullScreen: ReturnType<typeof vi.fn> } {
  const setFullScreen = vi.fn();
  const hote = {
    isDestroyed: () => false,
    isFullScreen: () => false,
    setFullScreen,
    getBounds: () => ({ x: 10, y: 20, width: 1280, height: 720 }),
  } as unknown as BrowserWindow;
  return { hote, setFullScreen };
}

beforeEach(() => {
  etatColle.poserRend = true;
  etatColle.poses = 0;
  etatColle.retraits = 0;
});

describe("SurfaceWaylandColle", () => {
  it("attach pose la colle et NE TOUCHE PAS au plein écran", async () => {
    const { hote, setFullScreen } = fauxHote();
    const surface = new SurfaceWaylandColle(hote);
    await surface.attach();
    expect(etatColle.poses).toBe(1);
    expect(setFullScreen).not.toHaveBeenCalled();
  });

  it("detach retire la colle, une seule fois", async () => {
    const { hote } = fauxHote();
    const surface = new SurfaceWaylandColle(hote);
    await surface.attach();
    surface.detach();
    surface.detach();
    expect(etatColle.retraits).toBe(1);
  });

  it("pose refusée : pas d'exception, et la géométrie le dit", async () => {
    etatColle.poserRend = false;
    const { hote, setFullScreen } = fauxHote();
    const surface = new SurfaceWaylandColle(hote);
    await surface.attach();
    expect(setFullScreen).not.toHaveBeenCalled();
    expect(surface.geometrie()).toContain("colle=absente");
    surface.detach();
    expect(etatColle.retraits).toBe(0);
  });

  it("la géométrie décrit l'hôte, la colle suivant côté compositeur", async () => {
    const { hote } = fauxHote();
    const surface = new SurfaceWaylandColle(hote);
    await surface.attach();
    expect(surface.geometrie()).toBe("wayland-colle hôte=1280x720+10+20 pleinÉcran=false colle=posée");
  });
});
