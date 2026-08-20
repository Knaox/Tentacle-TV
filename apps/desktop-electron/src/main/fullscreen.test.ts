import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Sortie du plein écran, et la frontière entre les deux systèmes.
 *
 * Sur Windows, le plein écran de cette application est une PARADE : la fenêtre
 * reste à l'état normal, on lui retire son cadre et on la pose sur tout l'écran
 * (cf. l'en-tête de `fullscreen.ts`). Quitter un film doit donc lui rendre le mode
 * qui était le sien — sans quoi on parcourt le catalogue dans une fenêtre sans
 * barre de titre, sans bouton de fermeture, par-dessus la barre des tâches.
 *
 * Sur macOS, rien de tout cela ne s'applique : le plein écran y est celui du
 * système, avec son espace dédié et ses commandes de fenêtre intactes. C'est la
 * contrainte que ce fichier garde.
 *
 * ⚠️ Ce qui n'est PAS couvert, et c'est assumé : le chemin où la sortie doit
 * réellement défaire le plein écran de Windows. Il passe par `entrer()`, donc par
 * `require("./video/win32")` — un chargement PARESSEUX qui existe parce que ce
 * module appelle `user32.dll` à l'import, et qu'un import statique ferait tomber
 * le processus principal sur macOS. Un `require` résolu à l'exécution n'est pas
 * interceptable par le banc d'essai, et tordre le code de production pour le
 * rendre testable coûterait plus que ce que le test rapporterait. Ce chemin se
 * vérifie à la main, sur Windows (cf. docs/TEST-1.20.2.md).
 */

const RECT = { x: 0, y: 0, width: 1920, height: 1080 };
const PETITE = { x: 100, y: 80, width: 1280, height: 800 };

/**
 * Une fenêtre de banc qui sait jouer AppKit.
 *
 * `setFullScreen(false)` ne rend pas la main tout de suite sur macOS —
 * l'animation d'espace dure de l'ordre de la seconde — et c'est l'évènement
 * `leave-full-screen` qui annonce la fin. Le code de production attend cet
 * évènement avant de rendre l'état zoomé ; un faux qui ne l'émettrait pas
 * laisserait le banc croire que rien ne se passe.
 */
function fenetre(options: { pleinEcran?: boolean; zoomee?: boolean; simple?: boolean } = {}) {
  let pleinEcran = options.pleinEcran ?? false;
  let zoomee = options.zoomee ?? false;
  const auditeurs = new Map<string, () => void>();

  const win = {
    maximize: vi.fn(() => {
      zoomee = true;
    }),
    unmaximize: vi.fn(() => {
      zoomee = false;
    }),
    setBounds: vi.fn(),
    setFullScreen: vi.fn((valeur: boolean) => {
      pleinEcran = valeur;
      if (!valeur) auditeurs.get("leave-full-screen")?.();
    }),
    setSimpleFullScreen: vi.fn(),
    focus: vi.fn(),
    once: vi.fn((nom: string, rappel: () => void) => {
      auditeurs.set(nom, rappel);
    }),
    isMaximized: () => zoomee,
    getBounds: () => RECT,
    getNormalBounds: () => PETITE,
    isFullScreen: () => pleinEcran,
    isSimpleFullScreen: () => options.simple ?? false,
    isDestroyed: () => false,
  };
  return win;
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

describe("macOS — la fenêtre retrouve le mode d'avant le film", () => {
  it("ne touche à rien quand le film s'est joué en fenêtré", async () => {
    const fs = await chargerPour("darwin");
    const win = fenetre();

    fs.ouvrirSessionLecteur(win as never);
    fs.fermerSessionLecteur(win as never);

    expect(win.maximize).not.toHaveBeenCalled();
    expect(win.setBounds).not.toHaveBeenCalled();
    expect(win.setFullScreen).not.toHaveBeenCalled();
  });

  it("rend une fenêtre FENÊTRÉE au plein écran posé par le film", async () => {
    const fs = await chargerPour("darwin");
    const win = fenetre();

    // Fenêtrée quand la vidéo commence…
    expect(fs.ouvrirSessionLecteur(win as never)).toBe(false);
    // …puis « plein écran » depuis le lecteur.
    fs.basculer(win as never);
    expect(win.setFullScreen).toHaveBeenCalledWith(true);

    fs.fermerSessionLecteur(win as never);

    expect(win.setFullScreen).toHaveBeenLastCalledWith(false);
    expect(win.maximize).not.toHaveBeenCalled();
  });

  it("rend le PLEIN ÉCRAN FENÊTRÉ à celle qui y était", async () => {
    const fs = await chargerPour("darwin");
    const win = fenetre({ zoomee: true });

    fs.ouvrirSessionLecteur(win as never);
    fs.basculer(win as never);
    // Le plein écran natif défait le zoom : c'est lui qu'il faudra rendre.
    win.unmaximize();

    fs.fermerSessionLecteur(win as never);

    expect(win.setFullScreen).toHaveBeenLastCalledWith(false);
    expect(win.maximize).toHaveBeenCalled();
  });

  it("laisse le plein écran de l'UTILISATEUR intact", async () => {
    const fs = await chargerPour("darwin");
    const win = fenetre({ pleinEcran: true });

    // Il y était AVANT le film : ce plein écran-là ne nous appartient pas.
    expect(fs.ouvrirSessionLecteur(win as never)).toBe(true);
    fs.fermerSessionLecteur(win as never);

    expect(win.setFullScreen).not.toHaveBeenCalled();
    expect(win.maximize).not.toHaveBeenCalled();
    expect(win.unmaximize).not.toHaveBeenCalled();
  });

  it("ne relit PAS l'état à chaque épisode", async () => {
    const fs = await chargerPour("darwin");
    const win = fenetre();

    // Le lecteur est remonté sur `key={itemId}` alors que la fenêtre, elle,
    // reste en plein écran : relire son état ferait conclure qu'il appartient à
    // l'utilisateur, et la fenêtre ne redescendrait plus jamais.
    expect(fs.ouvrirSessionLecteur(win as never)).toBe(false);
    fs.basculer(win as never);
    expect(fs.ouvrirSessionLecteur(win as never)).toBe(true); // état COURANT rendu…
    fs.fermerSessionLecteur(win as never);
    expect(win.setFullScreen).toHaveBeenLastCalledWith(false); // …mais session inchangée
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
    const win = fenetre({ pleinEcran: true, simple: true });

    fs.quitter(win as never);

    expect(win.setSimpleFullScreen).toHaveBeenCalledWith(false);
    expect(win.setFullScreen).toHaveBeenCalledWith(false);
  });
});

describe("Windows — session du lecteur", () => {
  it("ne touche à rien quand aucune session n'a été ouverte", async () => {
    const fs = await chargerPour("win32");
    const win = fenetre();

    fs.fermerSessionLecteur(win as never);

    expect(win.setBounds).not.toHaveBeenCalled();
    expect(win.maximize).not.toHaveBeenCalled();
  });

  it("ne touche à rien quand la fenêtre n'est pas en plein écran", async () => {
    const fs = await chargerPour("win32");
    const win = fenetre();

    // Film lancé en fenêtré, quitté en fenêtré : il n'y a rien à rendre.
    expect(fs.ouvrirSessionLecteur(win as never)).toBe(false);
    fs.fermerSessionLecteur(win as never);

    expect(win.setBounds).not.toHaveBeenCalled();
    expect(win.maximize).not.toHaveBeenCalled();
  });

  it("rend l'état COURANT à l'ouverture, et le rend à chaque épisode", async () => {
    const fs = await chargerPour("win32");
    const win = fenetre();

    // C'est cette valeur qui amorce l'état React du lecteur, et elle est relue à
    // chaque changement d'épisode (le lecteur est remonté sur `key={itemId}`).
    expect(fs.ouvrirSessionLecteur(win as never)).toBe(false);
    expect(fs.ouvrirSessionLecteur(win as never)).toBe(false);
  });

  it("referme la session, même quand il n'y a rien à défaire", async () => {
    const fs = await chargerPour("win32");
    const win = fenetre();

    fs.ouvrirSessionLecteur(win as never);
    fs.fermerSessionLecteur(win as never);
    // La seconde fermeture ne doit pas retrouver de session ouverte : un `entry`
    // laissé en place fausserait la lecture suivante.
    fs.fermerSessionLecteur(win as never);

    expect(win.setBounds).not.toHaveBeenCalled();
  });
});
