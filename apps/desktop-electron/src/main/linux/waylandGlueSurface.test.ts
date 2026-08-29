import type { BrowserWindow } from "electron";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * La surface collée : ce qui se garde ici, c'est ce qu'elle NE fait PAS —
 * jamais de plein écran forcé (tout l'objet du montage), un cycle pose/retrait
 * propre même quand KWin refuse — et la contre-lecture, qui repose la colle
 * quand la fenêtre mpv n'a pas suivi. UNE fois : reposer en boucle rendrait le
 * lecteur inutilisable là où la colle ne peut pas marcher.
 */

const { glueState } = vi.hoisted(() => ({
  glueState: { applyReturns: true, applied: 0, unloads: 0 },
}));

const { mpvState } = vi.hoisted(() => ({
  mpvState: { width: null as string | null, height: null as string | null },
}));

vi.mock("electron", () => ({
  screen: { getDisplayMatching: () => ({ scaleFactor: 2 }) },
}));

vi.mock("../video/mpv", () => ({
  getProperty: (name: string) =>
    Promise.resolve(name.endsWith("w") || name === "osd-width" ? mpvState.width : mpvState.height),
}));

vi.mock("./kwinGlue", () => ({
  KwinGlue: class {
    apply(): Promise<boolean> {
      glueState.applied += 1;
      return Promise.resolve(glueState.applyReturns);
    }
    remove(): Promise<void> {
      glueState.unloads += 1;
      return Promise.resolve();
    }
  },
}));

import { SurfaceWaylandGlue } from "./waylandGlueSurface";

function fakeHost(): { host: BrowserWindow; setFullScreen: ReturnType<typeof vi.fn> } {
  const setFullScreen = vi.fn();
  const host = {
    isDestroyed: () => false,
    isFullScreen: () => false,
    isMinimized: () => false,
    setFullScreen,
    getBounds: () => ({ x: 10, y: 20, width: 1280, height: 720 }),
  } as unknown as BrowserWindow;
  return { host, setFullScreen };
}

beforeEach(() => {
  glueState.applyReturns = true;
  glueState.applied = 0;
  glueState.unloads = 0;
  // L'écran du banc est à l'échelle 2 : l'hôte 1280x720 attend 2560x1440.
  mpvState.width = "2560";
  mpvState.height = "1440";
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("SurfaceWaylandColle", () => {
  it("attach pose la colle et NE TOUCHE PAS au plein écran", async () => {
    const { host, setFullScreen } = fakeHost();
    const surface = new SurfaceWaylandGlue(host);
    await surface.attach();
    expect(glueState.applied).toBe(1);
    expect(setFullScreen).not.toHaveBeenCalled();
  });

  it("detach retire la colle, une seule fois", async () => {
    const { host } = fakeHost();
    const surface = new SurfaceWaylandGlue(host);
    await surface.attach();
    surface.detach();
    surface.detach();
    expect(glueState.unloads).toBe(1);
  });

  it("pose refusée : pas d'exception, et la géométrie le dit", async () => {
    glueState.applyReturns = false;
    const { host, setFullScreen } = fakeHost();
    const surface = new SurfaceWaylandGlue(host);
    await surface.attach();
    expect(setFullScreen).not.toHaveBeenCalled();
    expect(surface.geometrie()).toContain("colle=absente");
    surface.detach();
    expect(glueState.unloads).toBe(0);
  });

  it("la géométrie décrit l'hôte, la colle suivant côté compositeur", async () => {
    const { host } = fakeHost();
    const surface = new SurfaceWaylandGlue(host);
    await surface.attach();
    expect(surface.geometrie()).toBe(
      "wayland-colle hôte=1280x720+10+20 pleinÉcran=false colle=posée témoin=indécidable",
    );
  });
});

describe("la contre-lecture de la colle", () => {
  it("fenêtre mpv à la taille de l'hôte : vérifiée, et plus rien à mesurer", async () => {
    const { host } = fakeHost();
    const surface = new SurfaceWaylandGlue(host);
    await surface.attach();

    surface.fileLoaded();
    await vi.advanceTimersByTimeAsync(400);
    expect(surface.geometrie()).toContain("témoin=collée");
    expect(glueState.applied).toBe(1);

    // Un second fichier ne rejoue pas une mesure déjà concluante.
    surface.fileLoaded();
    await vi.advanceTimersByTimeAsync(400);
    expect(glueState.applied).toBe(1);
  });

  it("fenêtre libre : une seconde pose, une seule, puis l'aveu", async () => {
    mpvState.width = "1920";
    mpvState.height = "1080";
    const { host } = fakeHost();
    const surface = new SurfaceWaylandGlue(host);
    await surface.attach();

    surface.fileLoaded();
    await vi.advanceTimersByTimeAsync(400);
    expect(glueState.unloads).toBe(1);
    expect(glueState.applied).toBe(2);

    // La seconde mesure part toute seule : elle ne dépend pas d'un nouveau
    // fichier. Toujours libre → on le dit, et on s'arrête là.
    await vi.advanceTimersByTimeAsync(400);
    expect(glueState.applied).toBe(2);
    expect(surface.geometrie()).toContain("témoin=libre");

    surface.fileLoaded();
    await vi.advanceTimersByTimeAsync(400);
    expect(glueState.applied).toBe(2);
  });

  it("mesure absente : aucun verdict, aucune seconde pose", async () => {
    mpvState.width = null;
    mpvState.height = null;
    const { host } = fakeHost();
    const surface = new SurfaceWaylandGlue(host);
    await surface.attach();

    surface.fileLoaded();
    await vi.advanceTimersByTimeAsync(400);
    expect(glueState.applied).toBe(1);
    expect(surface.geometrie()).toContain("témoin=indécidable");
  });

  it("detach coupe la vérification en vol", async () => {
    mpvState.width = "1920";
    mpvState.height = "1080";
    const { host } = fakeHost();
    const surface = new SurfaceWaylandGlue(host);
    await surface.attach();

    surface.fileLoaded();
    surface.detach();
    await vi.advanceTimersByTimeAsync(400);
    // Le retrait du détachement, et rien d'autre : pas de seconde pose.
    expect(glueState.unloads).toBe(1);
    expect(glueState.applied).toBe(1);
  });
});
