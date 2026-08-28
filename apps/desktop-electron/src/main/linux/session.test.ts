import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * L'aller-retour du choix de session : ce que les Préférences écrivent
 * (`enregistrerChoixSession`) doit être exactement ce que le prochain
 * démarrage lira (`lireChoixSession`). C'est la seule pièce de la boucle qui
 * n'était couverte nulle part — la décision, elle, a ses tests dans
 * `sessionGraphique.test.ts`.
 */

const { etat } = vi.hoisted(() => ({ etat: { userData: "" } }));

vi.mock("electron", () => ({
  app: {
    getPath: (nom: string) => {
      if (nom !== "userData") throw new Error(`chemin inattendu : ${nom}`);
      return etat.userData;
    },
    commandLine: { appendSwitch: () => undefined },
  },
}));

vi.mock("./kwinScripting", () => ({
  apiScriptKwinDisponible: () => Promise.resolve(dispoKwin.valeur),
}));
const { dispoKwin } = vi.hoisted(() => ({ dispoKwin: { valeur: true } }));

import {
  appliquerSessionGraphique,
  detecterFenetrage,
  enregistrerChoixSession,
  fenetrageLinux,
} from "./session";
import { lireChoixSession } from "./sessionGraphique";

let dossier: string;

beforeEach(() => {
  dossier = mkdtempSync(path.join(tmpdir(), "tentacle-session-"));
  etat.userData = dossier;
  delete process.env["TENTACLE_LINUX_SESSION"];
});

afterEach(() => {
  rmSync(dossier, { recursive: true, force: true });
});

describe("le choix de session, écrit puis relu", () => {
  it("rend au démarrage ce que les Préférences ont enregistré", () => {
    enregistrerChoixSession("x11");
    expect(lireChoixSession(dossier)).toBe("x11");

    enregistrerChoixSession("wayland");
    expect(lireChoixSession(dossier)).toBe("wayland");
  });

  it("sans fichier, le choix reste « auto »", () => {
    expect(lireChoixSession(dossier)).toBe("auto");
  });
});

describe("detecterFenetrage", () => {
  it("Wayland + API KWin → fenêtré libre ; sans API → plein écran forcé", async () => {
    process.env["TENTACLE_LINUX_SESSION"] = "wayland";
    appliquerSessionGraphique();

    dispoKwin.valeur = true;
    await detecterFenetrage();
    expect(fenetrageLinux()).toBe("libre");

    dispoKwin.valeur = false;
    await detecterFenetrage();
    expect(fenetrageLinux()).toBe("plein-ecran");
  });

  it("sous X11 la question ne se pose pas : null", async () => {
    process.env["TENTACLE_LINUX_SESSION"] = "x11";
    appliquerSessionGraphique();
    await detecterFenetrage();
    expect(fenetrageLinux()).toBeNull();
  });
});
