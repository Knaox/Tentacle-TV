import type { BrowserWindow } from "electron";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * La surface collée : ce qui se garde ici, c'est ce qu'elle NE fait PAS —
 * jamais de plein écran forcé (tout l'objet du montage), une colle posée UNE
 * fois par processus et jamais retirée au détachement — et la contre-lecture,
 * qui remesure avant d'accuser, repose la colle quand la fenêtre mpv n'a
 * vraiment pas suivi, UNE fois, puis l'avoue.
 */

const { glueState } = vi.hoisted(() => ({
  glueState: { applyReturns: true, live: false, applied: 0, unloads: 0 },
}));

const { mpvState } = vi.hoisted(() => ({
  mpvState: { width: null as string | null, height: null as string | null },
}));

// `displayTarget.ts` touche `screen` à l'import ; la mesure de la page, elle,
// vient du faux `webContents` de l'hôte.
vi.mock("electron", () => ({ screen: { getAllDisplays: () => [] } }));

vi.mock("../video/mpv", () => ({
  getProperty: (name: string) =>
    Promise.resolve(name.endsWith("w") || name === "osd-width" ? mpvState.width : mpvState.height),
}));

vi.mock("./liveGlue", () => ({
  liveGlue: () => (glueState.live ? {} : null),
  ensureLiveGlue: () => {
    if (glueState.live) return Promise.resolve({ live: true, fresh: false });
    if (!glueState.applyReturns) return Promise.resolve({ live: false, fresh: false });
    glueState.applied += 1;
    glueState.live = true;
    return Promise.resolve({ live: true, fresh: true });
  },
  reposeLiveGlue: () => {
    glueState.unloads += 1;
    glueState.applied += 1;
    glueState.live = glueState.applyReturns;
    return Promise.resolve(glueState.applyReturns);
  },
}));

import { SurfaceWaylandGlue } from "./waylandGlueSurface";

/** L'hôte du banc : 1280x720 logiques sur un écran ×2 — la page le mesure. */
function fakeHost(density = 2): { host: BrowserWindow; setFullScreen: ReturnType<typeof vi.fn> } {
  const setFullScreen = vi.fn();
  const host = {
    isDestroyed: () => false,
    isFullScreen: () => false,
    isMinimized: () => false,
    setFullScreen,
    getBounds: () => ({ x: 10, y: 20, width: 1280, height: 720 }),
    webContents: { executeJavaScript: () => Promise.resolve([1280, 720, density]) },
  } as unknown as BrowserWindow;
  return { host, setFullScreen };
}

beforeEach(() => {
  glueState.applyReturns = true;
  glueState.live = false;
  glueState.applied = 0;
  glueState.unloads = 0;
  // Collée, la fenêtre mpv fait l'hôte en pixels physiques : 2560x1440.
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

  it("la colle est celle du processus : un second attach ne repose rien, detach ne retire rien", async () => {
    const { host } = fakeHost();
    const first = new SurfaceWaylandGlue(host);
    await first.attach();
    first.detach();
    const second = new SurfaceWaylandGlue(host);
    await second.attach();
    second.detach();
    expect(glueState.applied).toBe(1);
    expect(glueState.unloads).toBe(0);
    expect(second.geometrie()).toContain("colle=posée");
  });

  it("pose refusée : pas d'exception, et la géométrie le dit", async () => {
    glueState.applyReturns = false;
    const { host, setFullScreen } = fakeHost();
    const surface = new SurfaceWaylandGlue(host);
    await surface.attach();
    expect(setFullScreen).not.toHaveBeenCalled();
    expect(surface.geometrie()).toContain("colle=absente");
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
  it("fenêtre mpv à la taille de la page : vérifiée, et plus rien à mesurer", async () => {
    const { host } = fakeHost();
    const surface = new SurfaceWaylandGlue(host);
    await surface.attach();

    surface.videoReconfigured();
    await vi.advanceTimersByTimeAsync(300);
    expect(surface.geometrie()).toContain("témoin=collée");
    expect(glueState.applied).toBe(1);

    // Un second fichier ne rejoue pas une mesure déjà concluante.
    surface.videoReconfigured();
    await vi.advanceTimersByTimeAsync(300);
    expect(glueState.applied).toBe(1);
  });

  it("l'échelle est celle de la PAGE, pas celle de l'écran à l'origine", async () => {
    // Le 17.09 : « mpv 2304x1656 · attendu 1440x1000 (×1.25) » — la fenêtre
    // suivait, l'échelle lue était celle d'un autre écran. Ici la page dit ×2.
    mpvState.width = "2304";
    mpvState.height = "1656";
    const { host } = fakeHost(2);
    const surface = new SurfaceWaylandGlue(
      { ...host, webContents: { executeJavaScript: () => Promise.resolve([1152, 800, 2]) } } as unknown as BrowserWindow,
    );
    await surface.attach();
    surface.videoReconfigured();
    await vi.advanceTimersByTimeAsync(300);
    expect(surface.geometrie()).toContain("témoin=collée");
  });

  it("fenêtre libre : un doute, une seconde pose, une seule, puis l'aveu", async () => {
    mpvState.width = "1920";
    mpvState.height = "1080";
    const { host } = fakeHost();
    const surface = new SurfaceWaylandGlue(host);
    await surface.attach();

    surface.videoReconfigured();
    // Première mesure : un doute — la géométrie s'écrit en asynchrone.
    await vi.advanceTimersByTimeAsync(300);
    expect(glueState.applied).toBe(1);
    expect(glueState.unloads).toBe(0);
    // Seconde mesure, toujours libre : la colle est reposée, une fois.
    await vi.advanceTimersByTimeAsync(300);
    expect(glueState.unloads).toBe(1);
    expect(glueState.applied).toBe(2);
    // Encore libre après la seconde pose : on le dit, et on s'arrête là.
    await vi.advanceTimersByTimeAsync(300);
    await vi.advanceTimersByTimeAsync(300);
    expect(glueState.applied).toBe(2);
    expect(surface.geometrie()).toContain("témoin=libre");

    surface.videoReconfigured();
    await vi.advanceTimersByTimeAsync(600);
    expect(glueState.applied).toBe(2);
  });

  it("mesure absente : aucun verdict, aucune seconde pose", async () => {
    mpvState.width = null;
    mpvState.height = null;
    const { host } = fakeHost();
    const surface = new SurfaceWaylandGlue(host);
    await surface.attach();

    surface.videoReconfigured();
    await vi.advanceTimersByTimeAsync(300);
    expect(glueState.applied).toBe(1);
    expect(surface.geometrie()).toContain("témoin=indécidable");
  });

  it("detach coupe la vérification en vol", async () => {
    mpvState.width = "1920";
    mpvState.height = "1080";
    const { host } = fakeHost();
    const surface = new SurfaceWaylandGlue(host);
    await surface.attach();

    surface.videoReconfigured();
    surface.detach();
    await vi.advanceTimersByTimeAsync(900);
    expect(glueState.unloads).toBe(0);
    expect(glueState.applied).toBe(1);
  });
});
