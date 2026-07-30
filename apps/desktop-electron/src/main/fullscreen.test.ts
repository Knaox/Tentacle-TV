import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Sortie du plein écran : ce qui doit rester intact sur macOS.
 *
 * Le plein écran de Windows est une PARADE — la fenêtre reste à l'état normal, on
 * lui retire son cadre et on la pose sur tout l'écran (cf. l'en-tête de
 * `fullscreen.ts`). Quitter le lecteur doit donc lui rendre son cadre en gardant
 * l'écran, c'est-à-dire l'agrandir : sans quoi on parcourt tout le catalogue dans
 * une fenêtre sans barre de titre, sans bouton de fermeture, par-dessus la barre
 * des tâches.
 *
 * Sur macOS, rien de tout cela ne doit s'appliquer : le plein écran y est celui du
 * système, avec son espace dédié et ses commandes de fenêtre intactes. C'est la
 * contrainte que ce fichier garde.
 *
 * ⚠️ Le chemin d'ENTRÉE en plein écran sous Windows n'est pas couvert, et ce n'est
 * pas un oubli : il passe par `require("./video/win32")`, un chargement PARESSEUX
 * qui existe parce que ce module appelle `user32.dll` à l'import — un import
 * statique ferait tomber le processus principal sur macOS. Un `require` résolu à
 * l'exécution n'est pas interceptable par le banc d'essai, et tordre le code de
 * production pour le rendre testable coûterait plus que ce que le test rapporte.
 * Ce chemin se vérifie à la main, sur Windows (cf. docs/TEST-1.20.2.md).
 */

const RECT = { x: 0, y: 0, width: 1920, height: 1080 };
const PETITE = { x: 100, y: 80, width: 1280, height: 800 };

function fenetre() {
  return {
    maximize: vi.fn(),
    unmaximize: vi.fn(),
    setBounds: vi.fn(),
    setFullScreen: vi.fn(),
    setSimpleFullScreen: vi.fn(),
    focus: vi.fn(),
    isMaximized: () => false,
    getBounds: () => RECT,
    getNormalBounds: () => PETITE,
    isFullScreen: () => false,
    isSimpleFullScreen: () => false,
    isDestroyed: () => false,
  };
}

vi.mock("electron", () => ({
  app: { isPackaged: false },
  screen: { getDisplayMatching: () => ({ bounds: RECT }) },
}));

const platformeReelle = process.platform;

/** `PARADE_WINDOWS` est figé à l'import : la plateforme se pose AVANT. */
async function chargerPour(plateforme: string) {
  Object.defineProperty(process, "platform", { value: plateforme, configurable: true });
  vi.resetModules();
  return import("./fullscreen");
}

afterEach(() => {
  Object.defineProperty(process, "platform", { value: platformeReelle, configurable: true });
});

describe("macOS — on ne touche à rien", () => {
  it("ignore la sortie du lecteur", async () => {
    const fs = await chargerPour("darwin");
    const win = fenetre();

    fs.retomberEnFenetreAgrandie(win as never);

    expect(win.maximize).not.toHaveBeenCalled();
    expect(win.setBounds).not.toHaveBeenCalled();
    expect(win.setFullScreen).not.toHaveBeenCalled();
  });

  it("garde le plein écran du SYSTÈME pour la bascule, sans parade", async () => {
    const fs = await chargerPour("darwin");
    const win = fenetre();

    expect(fs.basculer(win as never)).toBe(true);

    expect(win.setFullScreen).toHaveBeenCalledWith(true);
    // Aucune géométrie posée à la main : c'est le système qui place la fenêtre.
    expect(win.setBounds).not.toHaveBeenCalled();
  });

  it("sort par les deux portes — natif et plein écran simple d'avant", async () => {
    const fs = await chargerPour("darwin");
    // Une session ouverte avant la bascule vers le natif peut encore s'y trouver.
    const win = { ...fenetre(), isFullScreen: () => true, isSimpleFullScreen: () => true };

    fs.quitter(win as never);

    expect(win.setSimpleFullScreen).toHaveBeenCalledWith(false);
    expect(win.setFullScreen).toHaveBeenCalledWith(false);
  });
});

describe("Windows — hors plein écran", () => {
  it("quitter un lecteur FENÊTRÉ n'agrandit pas l'application", async () => {
    const fs = await chargerPour("win32");
    const win = fenetre();

    // Rien n'a été mis en plein écran : la sortie ne doit rien changer.
    expect(fs.estEnPleinEcran()).toBe(false);
    fs.retomberEnFenetreAgrandie(win as never);

    expect(win.maximize).not.toHaveBeenCalled();
    expect(win.setBounds).not.toHaveBeenCalled();
  });
});
