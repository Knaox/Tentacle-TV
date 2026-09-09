import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * L'aller-retour du choix de session : ce que les Préférences écrivent
 * (`saveSessionChoice`) doit être exactement ce que le prochain
 * démarrage lira (`readSessionChoice`). C'est la seule pièce de la boucle qui
 * n'était couverte nulle part — la décision, elle, a ses tests dans
 * `graphicsSession.test.ts`.
 */

const { state } = vi.hoisted(() => ({ state: { userData: "" } }));

vi.mock("electron", () => ({
  app: {
    getPath: (name: string) => {
      if (name !== "userData") throw new Error(`chemin inattendu : ${name}`);
      return state.userData;
    },
    commandLine: { appendSwitch: () => undefined },
  },
}));

vi.mock("./kwinScripting", () => ({
  kwinScriptApiAvailable: () => Promise.resolve(kwinAvailable.value),
}));
const { kwinAvailable } = vi.hoisted(() => ({ kwinAvailable: { value: true } }));

// Le ménage part au verdict « libre » : joué ici, il ne doit ni toucher au
// répertoire temporaire de la machine, ni parler au bus.
vi.mock("./glueCleanup", () => ({
  sweepOrphanGlue: () => {
    cleanup.sweeps += 1;
    return Promise.resolve(0);
  },
}));
const { cleanup } = vi.hoisted(() => ({ cleanup: { sweeps: 0 } }));

import {
  applyGraphicsSession,
  detectWindowing,
  saveSessionChoice,
  linuxWindowing,
} from "./session";
import { readSessionChoice } from "./graphicsSession";

let folder: string;

/**
 * Une session Wayland simulée — sans quoi `detecterFenetrage` ne peut rien dire.
 *
 * ⚠️ Il y faut DEUX conditions, et il en manquait deux :
 *
 *  1. `process.platform === "linux"` — `applyGraphicsSession` rend `null` sinon,
 *     et `detectWindowing` pose `windowing = null` ;
 *  2. un environnement qui RESSEMBLE à une session Wayland. `TENTACLE_LINUX_SESSION`
 *     ne porte que le CHOIX ; `decideSession` le ramène à X11 quand
 *     `desktopSession` ne voit pas de `WAYLAND_DISPLAY` — « demander wayland
 *     depuis une session X11 n'a pas de sens : il n'y a pas de compositeur à qui
 *     parler ».
 *
 * Faute des deux, ces cas échouaient partout : sur un poste macOS comme sur un
 * runner d'intégration, qui n'a pas plus de compositeur qu'un Mac. Ils
 * décrivent pourtant un comportement qui ne dépend pas de la machine qui les
 * joue. Même patron que `fullscreen.test.ts` et `mpvLib.test.ts`.
 *
 * La plateforme est lue à l'APPEL et non à l'import : la poser suffit, aucun
 * `vi.resetModules()` n'est nécessaire.
 */
const realPlatform = process.platform;
const realWayland = process.env["WAYLAND_DISPLAY"];
const realSessionType = process.env["XDG_SESSION_TYPE"];

const asWaylandLinux = (): void => {
  Object.defineProperty(process, "platform", { value: "linux", configurable: true });
  process.env["WAYLAND_DISPLAY"] = "wayland-0";
  process.env["XDG_SESSION_TYPE"] = "wayland";
};

const restoreEnv = (name: string, value: string | undefined): void => {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
};

beforeEach(() => {
  cleanup.sweeps = 0;
  folder = mkdtempSync(path.join(tmpdir(), "tentacle-session-"));
  state.userData = folder;
  delete process.env["TENTACLE_LINUX_SESSION"];
});

afterEach(() => {
  rmSync(folder, { recursive: true, force: true });
  Object.defineProperty(process, "platform", { value: realPlatform, configurable: true });
  restoreEnv("WAYLAND_DISPLAY", realWayland);
  restoreEnv("XDG_SESSION_TYPE", realSessionType);
});

describe("le choix de session, écrit puis relu", () => {
  it("rend au démarrage ce que les Préférences ont enregistré", () => {
    saveSessionChoice("x11");
    expect(readSessionChoice(folder)).toBe("x11");

    saveSessionChoice("wayland");
    expect(readSessionChoice(folder)).toBe("wayland");
  });

  it("sans fichier, le choix reste « auto »", () => {
    expect(readSessionChoice(folder)).toBe("auto");
  });
});

describe("detecterFenetrage", () => {
  beforeEach(asWaylandLinux);

  it("Wayland + API KWin → fenêtré libre ; sans API → plein écran forcé", async () => {
    process.env["TENTACLE_LINUX_SESSION"] = "wayland";
    applyGraphicsSession();

    kwinAvailable.value = true;
    await detectWindowing();
    expect(linuxWindowing()).toBe("libre");

    kwinAvailable.value = false;
    await detectWindowing();
    expect(linuxWindowing()).toBe("plein-ecran");
  });

  it("reprend les colles d'un lancement mort — mais seulement là où il y en a", async () => {
    process.env["TENTACLE_LINUX_SESSION"] = "wayland";
    applyGraphicsSession();

    kwinAvailable.value = true;
    await detectWindowing();
    expect(cleanup.sweeps).toBe(1);

    // Sans API de script, personne n'a jamais posé de colle ici : rien à reprendre.
    kwinAvailable.value = false;
    await detectWindowing();
    expect(cleanup.sweeps).toBe(1);
  });

  it("sous X11 la question ne se pose pas : null", async () => {
    process.env["TENTACLE_LINUX_SESSION"] = "x11";
    applyGraphicsSession();
    await detectWindowing();
    expect(linuxWindowing()).toBeNull();
  });
});
