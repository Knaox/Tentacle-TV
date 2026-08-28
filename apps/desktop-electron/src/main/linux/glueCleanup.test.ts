import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Le ménage de la colle, sur une racine à nous : les tests ne balaient pas le
 * répertoire temporaire de la machine qui les fait tourner.
 *
 * Ce qui se garde : on ne décroche QUE les pids morts (une instance de
 * développement et une instance installée coexistent), le nôtre est épargné,
 * et l'ancien dossier partagé du montage précédent finit par partir.
 */

const { pont } = vi.hoisted(() => ({ pont: { decroches: [] as string[] } }));

vi.mock("./kwinScripting", () => ({
  dechargerScript: (nom: string) => {
    pont.decroches.push(nom);
    return Promise.resolve(true);
  },
  dechargerScriptSync: (nom: string) => {
    pont.decroches.push(nom);
  },
}));

import {
  balayerCollesOrphelines,
  dossierPose,
  nomGreffon,
  retirerColleAuDepart,
} from "./glueCleanup";

/** Le maximum par défaut de `kernel.pid_max` : jamais attribué en pratique. */
const PID_MORT = 4194303;

let racine = "";

beforeEach(() => {
  pont.decroches.length = 0;
  racine = mkdtempSync(path.join(tmpdir(), "tentacle-menage-"));
});

afterEach(() => {
  rmSync(racine, { recursive: true, force: true });
});

function poserFausseColle(pid: number, numero: number): string {
  const dossier = path.join(racine, `tentacle-colle-${String(pid)}-${String(numero)}`);
  mkdirSync(dossier, { recursive: true });
  writeFileSync(path.join(dossier, "glue.qml"), "// faux", "utf8");
  return dossier;
}

describe("la disposition des chemins", () => {
  it("un dossier par pose, sous le pid — c'est lui que le balayage relit", () => {
    expect(path.basename(dossierPose(42, 3))).toBe("tentacle-colle-42-3");
    expect(nomGreffon(42)).toBe("tentacle-colle-42");
  });
});

describe("balayerCollesOrphelines", () => {
  it("décroche et efface les pids morts, épargne les vivants", async () => {
    const mort = poserFausseColle(PID_MORT, 1);
    const mortEncore = poserFausseColle(PID_MORT, 2);
    const nous = poserFausseColle(process.pid, 1);
    const vivantAilleurs = poserFausseColle(process.ppid, 1);

    expect(await balayerCollesOrphelines(racine)).toBe(1);
    expect(existsSync(mort)).toBe(false);
    expect(existsSync(mortEncore)).toBe(false);
    // Notre propre colle est peut-être POSÉE : la balayer la tuerait en vol.
    expect(existsSync(nous)).toBe(true);
    expect(existsSync(vivantAilleurs)).toBe(true);
    // Un seul décrochage pour les deux dossiers du même pid.
    expect(pont.decroches).toEqual([nomGreffon(PID_MORT)]);
  });

  it("emporte l'ancien dossier partagé, que plus personne n'écrit", async () => {
    const ancien = path.join(racine, "tentacle-colle");
    mkdirSync(ancien, { recursive: true });
    writeFileSync(path.join(ancien, "colle-1234-abcdef.qml"), "// ancien", "utf8");

    expect(await balayerCollesOrphelines(racine)).toBe(0);
    expect(existsSync(ancien)).toBe(false);
    // Ses greffons étaient anonymes : rien à décrocher, ils partiront avec KWin.
    expect(pont.decroches).toEqual([]);
  });

  it("racine illisible : zéro, sans jeter", async () => {
    await expect(balayerCollesOrphelines(path.join(racine, "absent"))).resolves.toBe(0);
  });
});

describe("retirerColleAuDepart", () => {
  it("décroche NOTRE greffon et n'efface que nos dossiers", () => {
    const nous = poserFausseColle(process.pid, 1);
    const autre = poserFausseColle(PID_MORT, 1);

    retirerColleAuDepart(racine);

    expect(pont.decroches).toEqual([nomGreffon(process.pid)]);
    expect(existsSync(nous)).toBe(false);
    // Le départ n'est pas le moment du ménage général : c'est le rôle du
    // balayage, au lancement suivant, qui sait vérifier qu'un pid est mort.
    expect(existsSync(autre)).toBe(true);
  });
});
