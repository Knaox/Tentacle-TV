import type { BrowserWindow } from "electron";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * La surface collée : ce qui se garde ici, c'est ce qu'elle NE fait PAS —
 * jamais de plein écran forcé (tout l'objet du montage), un cycle pose/retrait
 * propre même quand KWin refuse — et la contre-lecture, qui repose la colle
 * quand la fenêtre mpv n'a pas suivi. UNE fois : reposer en boucle rendrait le
 * lecteur inutilisable là où la colle ne peut pas marcher.
 */

const { etatColle } = vi.hoisted(() => ({
  etatColle: { poserRend: true, poses: 0, retraits: 0 },
}));

const { etatMpv } = vi.hoisted(() => ({
  etatMpv: { largeur: null as string | null, hauteur: null as string | null },
}));

vi.mock("electron", () => ({
  screen: { getDisplayMatching: () => ({ scaleFactor: 2 }) },
}));

vi.mock("../video/mpv", () => ({
  getProperty: (nom: string) =>
    Promise.resolve(nom.endsWith("w") || nom === "osd-width" ? etatMpv.largeur : etatMpv.hauteur),
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
    isMinimized: () => false,
    setFullScreen,
    getBounds: () => ({ x: 10, y: 20, width: 1280, height: 720 }),
  } as unknown as BrowserWindow;
  return { hote, setFullScreen };
}

beforeEach(() => {
  etatColle.poserRend = true;
  etatColle.poses = 0;
  etatColle.retraits = 0;
  // L'écran du banc est à l'échelle 2 : l'hôte 1280x720 attend 2560x1440.
  etatMpv.largeur = "2560";
  etatMpv.hauteur = "1440";
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
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
    expect(surface.geometrie()).toBe(
      "wayland-colle hôte=1280x720+10+20 pleinÉcran=false colle=posée témoin=indécidable",
    );
  });
});

describe("la contre-lecture de la colle", () => {
  it("fenêtre mpv à la taille de l'hôte : vérifiée, et plus rien à mesurer", async () => {
    const { hote } = fauxHote();
    const surface = new SurfaceWaylandColle(hote);
    await surface.attach();

    surface.fichierCharge();
    await vi.advanceTimersByTimeAsync(400);
    expect(surface.geometrie()).toContain("témoin=collée");
    expect(etatColle.poses).toBe(1);

    // Un second fichier ne rejoue pas une mesure déjà concluante.
    surface.fichierCharge();
    await vi.advanceTimersByTimeAsync(400);
    expect(etatColle.poses).toBe(1);
  });

  it("fenêtre libre : une seconde pose, une seule, puis l'aveu", async () => {
    etatMpv.largeur = "1920";
    etatMpv.hauteur = "1080";
    const { hote } = fauxHote();
    const surface = new SurfaceWaylandColle(hote);
    await surface.attach();

    surface.fichierCharge();
    await vi.advanceTimersByTimeAsync(400);
    expect(etatColle.retraits).toBe(1);
    expect(etatColle.poses).toBe(2);

    // La seconde mesure part toute seule : elle ne dépend pas d'un nouveau
    // fichier. Toujours libre → on le dit, et on s'arrête là.
    await vi.advanceTimersByTimeAsync(400);
    expect(etatColle.poses).toBe(2);
    expect(surface.geometrie()).toContain("témoin=libre");

    surface.fichierCharge();
    await vi.advanceTimersByTimeAsync(400);
    expect(etatColle.poses).toBe(2);
  });

  it("mesure absente : aucun verdict, aucune seconde pose", async () => {
    etatMpv.largeur = null;
    etatMpv.hauteur = null;
    const { hote } = fauxHote();
    const surface = new SurfaceWaylandColle(hote);
    await surface.attach();

    surface.fichierCharge();
    await vi.advanceTimersByTimeAsync(400);
    expect(etatColle.poses).toBe(1);
    expect(surface.geometrie()).toContain("témoin=indécidable");
  });

  it("detach coupe la vérification en vol", async () => {
    etatMpv.largeur = "1920";
    etatMpv.hauteur = "1080";
    const { hote } = fauxHote();
    const surface = new SurfaceWaylandColle(hote);
    await surface.attach();

    surface.fichierCharge();
    surface.detach();
    await vi.advanceTimersByTimeAsync(400);
    // Le retrait du détachement, et rien d'autre : pas de seconde pose.
    expect(etatColle.retraits).toBe(1);
    expect(etatColle.poses).toBe(1);
  });
});
