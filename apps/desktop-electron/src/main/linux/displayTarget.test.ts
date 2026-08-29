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
  shownCandidates,
  labelByMeasure,
  labelOnceMapped,
  pageMeasure,
} from "./displayTarget";

// Relevés tels quels sur le poste de mesure.
const SHOWN = [
  { label: "Dell Inc. DELL S2721DGF", size: { width: 1152, height: 2048 }, scaleFactor: 1.25 },
  { label: "ASUSTek COMPUTER INC XG27UCDMG", size: { width: 1920, height: 1080 }, scaleFactor: 2 },
  { label: "Samsung Electric Company Odyssey G40B", size: { width: 1920, height: 1080 }, scaleFactor: 1 },
];
vi.mock("electron", () => ({
  screen: { getAllDisplays: () => SHOWN },
}));

const CANDIDATES = [
  { label: "Dell Inc. DELL S2721DGF", width: 1152, height: 2048, density: 1.25 },
  { label: "ASUSTek COMPUTER INC XG27UCDMG", width: 1920, height: 1080, density: 2 },
  { label: "Samsung Electric Company Odyssey G40B", width: 1920, height: 1080, density: 1 },
];

/** Une fenêtre dont le test tient l'état — et dont la page répond ce qu'on veut. */
function window(options: { fullscreen?: boolean; destroyed?: boolean; response?: unknown } = {}) {
  const state = { fullscreen: options.fullscreen ?? true, destroyed: options.destroyed ?? false };
  return {
    state,
    isDestroyed: () => state.destroyed,
    isFullScreen: () => state.fullscreen,
    webContents: {
      executeJavaScript: vi.fn(async () => {
        if (options.response instanceof Error) throw options.response;
        return options.response ?? [1920, 1080, 2];
      }),
    },
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("libelleParMesure", () => {
  it("désigne l'écran du trio, la densité tranchant les tailles jumelles", async () => {
    await expect(labelByMeasure(window({ response: [1920, 1080, 2] }), CANDIDATES)).resolves.toBe(
      "ASUSTek COMPUTER INC XG27UCDMG",
    );
    await expect(labelByMeasure(window({ response: [1920, 1080, 1] }), CANDIDATES)).resolves.toBe(
      "Samsung Electric Company Odyssey G40B",
    );
  });

  it("ne dit rien d'une fenêtre qui n'est pas en plein écran", async () => {
    // Une fenêtre FENÊTRÉE de 1920×1080 posée sur l'écran 4K correspondrait au
    // Samsung : apparence valide, écran faux. La garde passe avant la mesure.
    const win = window({ fullscreen: false, response: [1920, 1080, 1] });
    await expect(labelByMeasure(win, CANDIDATES)).resolves.toBeNull();
    expect(win.webContents.executeJavaScript).not.toHaveBeenCalled();
  });

  it("ne dit rien d'une fenêtre détruite", async () => {
    await expect(labelByMeasure(window({ destroyed: true }), CANDIDATES)).resolves.toBeNull();
  });

  it("rend null quand la page répond n'importe quoi", async () => {
    // `devicePixelRatio` traverse le pont en flottant, mais un zoom de page, un
    // tableau tronqué ou une exception ne doivent jamais désigner un écran.
    for (const response of ["texte", [1920, 1080], [Number.NaN, 1080, 2], [-1920, 1080, 2], new Error("page partie")]) {
      await expect(labelByMeasure(window({ response }), CANDIDATES)).resolves.toBeNull();
    }
  });
});

describe("candidatsAffiches", () => {
  it("projette les écrans d'Electron en candidats comparables", () => {
    expect(shownCandidates()).toEqual(CANDIDATES);
  });
});

describe("mesureDeLaPage", () => {
  it("lit le trio en nombres finis, et rien d'autre", async () => {
    const win = window({ response: [1152, 2048, 1.25] });
    await expect(pageMeasure(win.webContents)).resolves.toEqual({
      width: 1152,
      height: 2048,
      density: 1.25,
    });
  });
});

describe("libelleUneFoisMappee", () => {
  it("attend le mappage : la mesure se rejoue jusqu'à désigner un écran", async () => {
    // Le compositeur met ~200 ms à mapper le plein écran (mesuré : 202-203 ms
    // sur trois runs) — les premiers pas ne voient qu'une fenêtre fenêtrée.
    const win = window({ fullscreen: false, response: [1920, 1080, 2] });
    const promise = labelOnceMapped(win, { candidates: CANDIDATES });
    await vi.advanceTimersByTimeAsync(200);
    win.state.fullscreen = true;
    await vi.advanceTimersByTimeAsync(100);
    await expect(promise).resolves.toBe("ASUSTek COMPUTER INC XG27UCDMG");
    expect(win.webContents.executeJavaScript).toHaveBeenCalledTimes(1);
  });

  it("s'arrête net quand l'attente n'a plus d'objet", async () => {
    const win = window({ fullscreen: false });
    const promise = labelOnceMapped(win, { candidates: CANDIDATES, still: () => false });
    await expect(promise).resolves.toBeNull();
    expect(win.webContents.executeJavaScript).not.toHaveBeenCalled();
  });

  it("s'épuise sans jamais forcer un écran", async () => {
    // Jumeaux, page muette, fenêtre jamais mappée : après l'épuisement, null —
    // mpv choisira seul, ce qui vaut toujours mieux qu'un ordre faux.
    const win = window({ response: [800, 600, 1] });
    const promise = labelOnceMapped(win, { candidates: CANDIDATES, tries: 3, stepMs: 50 });
    await vi.advanceTimersByTimeAsync(200);
    await expect(promise).resolves.toBeNull();
    expect(win.webContents.executeJavaScript).toHaveBeenCalledTimes(3);
  });
});
