/**
 * La visée par la mesure de la page — ce que le trio a le droit de dire.
 *
 * Le défaut gardé ici est celui du poste réel : deux écrans de même taille
 * logique (1920×1080) que seule la densité sépare, et un `getBounds()` Wayland
 * qui ment. Une identification qui se tromperait d'écran enverrait mpv plein
 * écran sur le mauvais moniteur — le défaut mesuré du 27.08.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  candidatsAffiches,
  libelleParMesure,
  libelleUneFoisMappee,
  mesureDeLaPage,
} from "./displayTarget";

// Relevés tels quels sur le poste de mesure.
const AFFICHES = [
  { label: "Dell Inc. DELL S2721DGF", size: { width: 1152, height: 2048 }, scaleFactor: 1.25 },
  { label: "ASUSTek COMPUTER INC XG27UCDMG", size: { width: 1920, height: 1080 }, scaleFactor: 2 },
  { label: "Samsung Electric Company Odyssey G40B", size: { width: 1920, height: 1080 }, scaleFactor: 1 },
];
vi.mock("electron", () => ({
  screen: { getAllDisplays: () => AFFICHES },
}));

const CANDIDATS = [
  { label: "Dell Inc. DELL S2721DGF", largeur: 1152, hauteur: 2048, densite: 1.25 },
  { label: "ASUSTek COMPUTER INC XG27UCDMG", largeur: 1920, hauteur: 1080, densite: 2 },
  { label: "Samsung Electric Company Odyssey G40B", largeur: 1920, hauteur: 1080, densite: 1 },
];

/** Une fenêtre dont le test tient l'état — et dont la page répond ce qu'on veut. */
function fenetre(options: { pleinEcran?: boolean; detruite?: boolean; reponse?: unknown } = {}) {
  const etat = { pleinEcran: options.pleinEcran ?? true, detruite: options.detruite ?? false };
  return {
    etat,
    isDestroyed: () => etat.detruite,
    isFullScreen: () => etat.pleinEcran,
    webContents: {
      executeJavaScript: vi.fn(async () => {
        if (options.reponse instanceof Error) throw options.reponse;
        return options.reponse ?? [1920, 1080, 2];
      }),
    },
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("libelleParMesure", () => {
  it("désigne l'écran du trio, la densité tranchant les tailles jumelles", async () => {
    await expect(libelleParMesure(fenetre({ reponse: [1920, 1080, 2] }), CANDIDATS)).resolves.toBe(
      "ASUSTek COMPUTER INC XG27UCDMG",
    );
    await expect(libelleParMesure(fenetre({ reponse: [1920, 1080, 1] }), CANDIDATS)).resolves.toBe(
      "Samsung Electric Company Odyssey G40B",
    );
  });

  it("ne dit rien d'une fenêtre qui n'est pas en plein écran", async () => {
    // Une fenêtre FENÊTRÉE de 1920×1080 posée sur l'écran 4K correspondrait au
    // Samsung : apparence valide, écran faux. La garde passe avant la mesure.
    const win = fenetre({ pleinEcran: false, reponse: [1920, 1080, 1] });
    await expect(libelleParMesure(win, CANDIDATS)).resolves.toBeNull();
    expect(win.webContents.executeJavaScript).not.toHaveBeenCalled();
  });

  it("ne dit rien d'une fenêtre détruite", async () => {
    await expect(libelleParMesure(fenetre({ detruite: true }), CANDIDATS)).resolves.toBeNull();
  });

  it("rend null quand la page répond n'importe quoi", async () => {
    // `devicePixelRatio` traverse le pont en flottant, mais un zoom de page, un
    // tableau tronqué ou une exception ne doivent jamais désigner un écran.
    for (const reponse of ["texte", [1920, 1080], [Number.NaN, 1080, 2], [-1920, 1080, 2], new Error("page partie")]) {
      await expect(libelleParMesure(fenetre({ reponse }), CANDIDATS)).resolves.toBeNull();
    }
  });
});

describe("candidatsAffiches", () => {
  it("projette les écrans d'Electron en candidats comparables", () => {
    expect(candidatsAffiches()).toEqual(CANDIDATS);
  });
});

describe("mesureDeLaPage", () => {
  it("lit le trio en nombres finis, et rien d'autre", async () => {
    const win = fenetre({ reponse: [1152, 2048, 1.25] });
    await expect(mesureDeLaPage(win.webContents)).resolves.toEqual({
      largeur: 1152,
      hauteur: 2048,
      densite: 1.25,
    });
  });
});

describe("libelleUneFoisMappee", () => {
  it("attend le mappage : la mesure se rejoue jusqu'à désigner un écran", async () => {
    // Le compositeur met ~200 ms à mapper le plein écran (mesuré : 202-203 ms
    // sur trois runs) — les premiers pas ne voient qu'une fenêtre fenêtrée.
    const win = fenetre({ pleinEcran: false, reponse: [1920, 1080, 2] });
    const promesse = libelleUneFoisMappee(win, { candidats: CANDIDATS });
    await vi.advanceTimersByTimeAsync(200);
    win.etat.pleinEcran = true;
    await vi.advanceTimersByTimeAsync(100);
    await expect(promesse).resolves.toBe("ASUSTek COMPUTER INC XG27UCDMG");
    expect(win.webContents.executeJavaScript).toHaveBeenCalledTimes(1);
  });

  it("s'arrête net quand l'attente n'a plus d'objet", async () => {
    const win = fenetre({ pleinEcran: false });
    const promesse = libelleUneFoisMappee(win, { candidats: CANDIDATS, encore: () => false });
    await expect(promesse).resolves.toBeNull();
    expect(win.webContents.executeJavaScript).not.toHaveBeenCalled();
  });

  it("s'épuise sans jamais forcer un écran", async () => {
    // Jumeaux, page muette, fenêtre jamais mappée : après l'épuisement, null —
    // mpv choisira seul, ce qui vaut toujours mieux qu'un ordre faux.
    const win = fenetre({ reponse: [800, 600, 1] });
    const promesse = libelleUneFoisMappee(win, { candidats: CANDIDATS, essais: 3, pasMs: 50 });
    await vi.advanceTimersByTimeAsync(200);
    await expect(promesse).resolves.toBeNull();
    expect(win.webContents.executeJavaScript).toHaveBeenCalledTimes(3);
  });
});
