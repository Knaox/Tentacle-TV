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
 * Sur macOS, rien de tout cela ne s'applique, et la règle est même l'INVERSE :
 * quitter un film ne touche PLUS à la fenêtre. Le plein écran y est celui du
 * système, avec son espace dédié — en sortir fait glisser tout l'écran vers le
 * bureau d'origine, et cette transition, ouverte à l'instant où mpv meurt,
 * laissait sa fenêtre noire seule à l'écran. Fenêtrée, zoomée ou en plein écran,
 * l'état de la fenêtre appartient désormais à l'utilisateur. C'est la contrainte
 * que ce fichier garde, des deux côtés.
 *
 * ⚠️ Ce qui n'est PAS couvert, et c'est assumé : le chemin où la sortie doit
 * réellement défaire le plein écran de Windows. Il passe par `enter()`, donc par
 * `require("./video/win32")` — un chargement PARESSEUX qui existe parce que ce
 * module appelle `user32.dll` à l'import, et qu'un import statique ferait tomber
 * le processus principal sur macOS. Un `require` résolu à l'exécution n'est pas
 * interceptable par le banc d'essai, et tordre le code de production pour le
 * rendre testable coûterait plus que ce que le test rapporterait. Ce chemin se
 * vérifie à la main, sur Windows (cf. docs/TEST-1.20.2.md).
 */

const RECT = { x: 0, y: 0, width: 1920, height: 1080 };
const SMALL = { x: 100, y: 80, width: 1280, height: 800 };

/**
 * Une fenêtre de banc qui sait jouer AppKit.
 *
 * `setFullScreen(false)` ne rend pas la main tout de suite sur macOS —
 * l'animation d'espace dure de l'ordre de la seconde — et c'est l'évènement
 * `leave-full-screen` qui annonce la fin. Le code de production attend cet
 * évènement avant de rendre l'état zoomé ; un faux qui ne l'émettrait pas
 * laisserait le banc croire que rien ne se passe.
 */
function window(options: { fullscreen?: boolean; zoomed?: boolean; simple?: boolean } = {}) {
  let fullscreen = options.fullscreen ?? false;
  let zoomed = options.zoomed ?? false;
  const listeners = new Map<string, () => void>();

  const win = {
    maximize: vi.fn(() => {
      zoomed = true;
    }),
    unmaximize: vi.fn(() => {
      zoomed = false;
    }),
    setBounds: vi.fn(),
    setFullScreen: vi.fn((value: boolean) => {
      fullscreen = value;
      if (!value) listeners.get("leave-full-screen")?.();
    }),
    setSimpleFullScreen: vi.fn(),
    focus: vi.fn(),
    once: vi.fn((name: string, callback: () => void) => {
      listeners.set(name, callback);
    }),
    isMaximized: () => zoomed,
    getBounds: () => RECT,
    getNormalBounds: () => SMALL,
    isFullScreen: () => fullscreen,
    isSimpleFullScreen: () => options.simple ?? false,
    isDestroyed: () => false,
  };
  return win;
}

vi.mock("electron", () => ({
  app: { isPackaged: false },
  screen: { getDisplayMatching: () => ({ bounds: RECT }) },
}));

const realPlatform = process.platform;

/** `WINDOWS_WORKAROUND` est figé à l'import : la plateforme se pose AVANT. */
async function loadFor(platform: string) {
  Object.defineProperty(process, "platform", { value: platform, configurable: true });
  vi.resetModules();
  // La bascule et la session vivent dans deux modules depuis que le second a
  // cessé de décider quoi que ce soit sur macOS. Les tests interrogent les deux :
  // c'est leur ACCORD qui est la contrainte.
  return { ...(await import("./fullscreen")), ...(await import("./playerFullscreenSession")) };
}

afterEach(() => {
  Object.defineProperty(process, "platform", { value: realPlatform, configurable: true });
});

describe("macOS — la fenêtre garde l'état que l'utilisateur lui a donné", () => {
  it("ne touche à rien quand le film s'est joué en fenêtré", async () => {
    const fs = await loadFor("darwin");
    const win = window();

    fs.openPlayerSession(win as never);
    fs.closePlayerSession(win as never);

    expect(win.maximize).not.toHaveBeenCalled();
    expect(win.setBounds).not.toHaveBeenCalled();
    expect(win.setFullScreen).not.toHaveBeenCalled();
  });

  it("GARDE le plein écran posé depuis le lecteur", async () => {
    const fs = await loadFor("darwin");
    const win = window();

    // Fenêtrée quand la vidéo commence…
    expect(fs.openPlayerSession(win as never)).toBe(false);
    // …puis « plein écran » depuis le lecteur.
    fs.toggle(win as never);
    expect(win.setFullScreen).toHaveBeenCalledWith(true);

    fs.closePlayerSession(win as never);

    // Et c'est tout : aucune sortie, donc aucune animation d'espace à traverser
    // pendant que mpv meurt — c'est elle qui laissait sa fenêtre noire à l'écran.
    expect(win.setFullScreen).not.toHaveBeenCalledWith(false);
    expect(win.isFullScreen()).toBe(true);
  });

  it("laisse ZOOMÉE la fenêtre qui l'était", async () => {
    const fs = await loadFor("darwin");
    const win = window({ zoomed: true });

    fs.openPlayerSession(win as never);
    fs.closePlayerSession(win as never);

    expect(win.isMaximized()).toBe(true);
    expect(win.unmaximize).not.toHaveBeenCalled();
    expect(win.setFullScreen).not.toHaveBeenCalled();
  });

  it("ne rezoome PAS une fenêtre que le plein écran avait dézoomée", async () => {
    const fs = await loadFor("darwin");
    const win = window({ zoomed: true });

    fs.openPlayerSession(win as never);
    fs.toggle(win as never);
    // Le plein écran natif défait le zoom. On le lui laissait rendre ; plus
    // maintenant — la fenêtre est là où l'utilisateur l'a mise en dernier.
    win.unmaximize();
    win.maximize.mockClear();

    fs.closePlayerSession(win as never);

    expect(win.maximize).not.toHaveBeenCalled();
  });

  it("laisse le plein écran de l'UTILISATEUR intact", async () => {
    const fs = await loadFor("darwin");
    const win = window({ fullscreen: true });

    // Il y était AVANT le film, et il y est encore après : rien ne le distingue
    // plus du plein écran posé par le lecteur, et c'est bien le but.
    expect(fs.openPlayerSession(win as never)).toBe(true);
    fs.closePlayerSession(win as never);

    expect(win.setFullScreen).not.toHaveBeenCalled();
    expect(win.maximize).not.toHaveBeenCalled();
    expect(win.unmaximize).not.toHaveBeenCalled();
  });

  it("rend l'état COURANT à chaque montage — c'est lui qui amorce le lecteur", async () => {
    const fs = await loadFor("darwin");
    const win = window();

    // Le lecteur est remonté sur `key={itemId}` à chaque épisode, et il doit
    // retrouver l'icône, la touche Échap et les gardes de sortie en accord avec
    // la fenêtre réelle — laquelle reste en plein écran d'un épisode à l'autre.
    expect(fs.openPlayerSession(win as never)).toBe(false);
    fs.toggle(win as never);
    expect(fs.openPlayerSession(win as never)).toBe(true);

    fs.closePlayerSession(win as never);
    expect(win.setFullScreen).not.toHaveBeenCalledWith(false);
  });

  it("garde le plein écran du SYSTÈME pour la bascule, sans parade", async () => {
    const fs = await loadFor("darwin");
    const win = window();

    expect(fs.toggle(win as never)).toBe(true);

    expect(win.setFullScreen).toHaveBeenCalledWith(true);
    // Aucune géométrie posée à la main : c'est le système qui place la fenêtre.
    expect(win.setBounds).not.toHaveBeenCalled();
  });

  it("sort quand l'UTILISATEUR le demande — bouton du lecteur, ou Échap", async () => {
    const fs = await loadFor("darwin");
    const win = window();

    fs.openPlayerSession(win as never);
    fs.toggle(win as never);
    // Ce chemin-là ne change pas, et c'est le seul qui doive encore redescendre.
    expect(fs.toggle(win as never)).toBe(false);

    expect(win.setFullScreen).toHaveBeenLastCalledWith(false);
  });

  it("sort par les deux portes — natif et plein écran simple d'avant", async () => {
    const fs = await loadFor("darwin");
    // Une session ouverte avant la bascule vers le natif peut encore s'y trouver.
    const win = window({ fullscreen: true, simple: true });

    fs.leave(win as never);

    expect(win.setSimpleFullScreen).toHaveBeenCalledWith(false);
    expect(win.setFullScreen).toHaveBeenCalledWith(false);
  });
});

describe("Windows — session du lecteur", () => {
  it("ne touche à rien quand aucune session n'a été ouverte", async () => {
    const fs = await loadFor("win32");
    const win = window();

    fs.closePlayerSession(win as never);

    expect(win.setBounds).not.toHaveBeenCalled();
    expect(win.maximize).not.toHaveBeenCalled();
  });

  it("ne touche à rien quand la fenêtre n'est pas en plein écran", async () => {
    const fs = await loadFor("win32");
    const win = window();

    // Film lancé en fenêtré, quitté en fenêtré : il n'y a rien à rendre.
    expect(fs.openPlayerSession(win as never)).toBe(false);
    fs.closePlayerSession(win as never);

    expect(win.setBounds).not.toHaveBeenCalled();
    expect(win.maximize).not.toHaveBeenCalled();
  });

  it("rend l'état COURANT à l'ouverture, et le rend à chaque épisode", async () => {
    const fs = await loadFor("win32");
    const win = window();

    // C'est cette valeur qui amorce l'état React du lecteur, et elle est relue à
    // chaque changement d'épisode (le lecteur est remonté sur `key={itemId}`).
    expect(fs.openPlayerSession(win as never)).toBe(false);
    expect(fs.openPlayerSession(win as never)).toBe(false);
  });

  it("referme la session, même quand il n'y a rien à défaire", async () => {
    const fs = await loadFor("win32");
    const win = window();

    fs.openPlayerSession(win as never);
    fs.closePlayerSession(win as never);
    // La seconde fermeture ne doit pas retrouver de session ouverte : un `entry`
    // laissé en place fausserait la lecture suivante.
    fs.closePlayerSession(win as never);

    expect(win.setBounds).not.toHaveBeenCalled();
  });
});

/**
 * Linux : le plein écran NATIF, comme macOS — la parade Windows n'existe pas
 * ici. Avant la ligne `NATIVE_FULLSCREEN = darwin || linux`, `enter()` sortait
 * sans rien faire : le bouton plein écran du lecteur était inopérant, et aucun
 * test ne le voyait.
 */
describe("Linux — plein écran natif, sans parade", () => {
  it("entre par setFullScreen, sans jamais toucher aux bounds", async () => {
    const fs = await loadFor("linux");
    const win = window();

    expect(fs.toggle(win as never)).toBe(true);

    expect(win.setFullScreen).toHaveBeenCalledWith(true);
    expect(win.setBounds).not.toHaveBeenCalled();
    expect(win.isFullScreen()).toBe(true);
  });

  it("re-basculer sort du plein écran", async () => {
    const fs = await loadFor("linux");
    const win = window();

    fs.toggle(win as never);
    expect(fs.toggle(win as never)).toBe(false);

    expect(win.setFullScreen).toHaveBeenCalledWith(false);
    expect(win.isFullScreen()).toBe(false);
  });

  it("lit l'état sur la FENÊTRE : un plein écran posé ailleurs est vu", async () => {
    const fs = await loadFor("linux");
    const win = window({ fullscreen: true });

    // `openPlayerSession` note la fenêtre puis interroge l'état courant —
    // c'est la valeur qui amorce l'état React du lecteur.
    expect(fs.openPlayerSession(win as never)).toBe(true);
  });

  it("quitter le lecteur ne touche à RIEN, comme sur macOS", async () => {
    const fs = await loadFor("linux");
    const win = window();

    fs.openPlayerSession(win as never);
    fs.toggle(win as never);
    fs.closePlayerSession(win as never);

    // Le plein écran reste : l'état de la fenêtre appartient à l'utilisateur.
    expect(win.setFullScreen).not.toHaveBeenCalledWith(false);
    expect(win.isFullScreen()).toBe(true);
  });

  it("quitter() force la sortie, quel que soit l'appelant", async () => {
    const fs = await loadFor("linux");
    const win = window({ fullscreen: true });

    fs.openPlayerSession(win as never);
    fs.leave(win as never);

    expect(win.setFullScreen).toHaveBeenCalledWith(false);
    expect(win.isFullScreen()).toBe(false);
  });
});
