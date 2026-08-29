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

beforeEach(() => {
  cleanup.sweeps = 0;
  folder = mkdtempSync(path.join(tmpdir(), "tentacle-session-"));
  state.userData = folder;
  delete process.env["TENTACLE_LINUX_SESSION"];
});

afterEach(() => {
  rmSync(folder, { recursive: true, force: true });
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
