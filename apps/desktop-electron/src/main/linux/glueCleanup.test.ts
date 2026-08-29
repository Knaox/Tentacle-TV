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

const { bridge } = vi.hoisted(() => ({ bridge: { detached: [] as string[] } }));

vi.mock("./kwinScripting", () => ({
  unloadScript: (name: string) => {
    bridge.detached.push(name);
    return Promise.resolve(true);
  },
  unloadScriptSync: (name: string) => {
    bridge.detached.push(name);
  },
}));

import {
  sweepOrphanGlue,
  glueFolder,
  pluginName,
  removeGlueAtStartup,
} from "./glueCleanup";

/** Le maximum par défaut de `kernel.pid_max` : jamais attribué en pratique. */
const DEAD_PID = 4194303;

let root = "";

beforeEach(() => {
  bridge.detached.length = 0;
  root = mkdtempSync(path.join(tmpdir(), "tentacle-menage-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function writeFakeGlue(pid: number, number: number): string {
  const folder = path.join(root, `tentacle-colle-${String(pid)}-${String(number)}`);
  mkdirSync(folder, { recursive: true });
  writeFileSync(path.join(folder, "glue.qml"), "// faux", "utf8");
  return folder;
}

describe("la disposition des chemins", () => {
  it("un dossier par pose, sous le pid — c'est lui que le balayage relit", () => {
    expect(path.basename(glueFolder(42, 3))).toBe("tentacle-colle-42-3");
    expect(pluginName(42)).toBe("tentacle-colle-42");
  });
});

describe("balayerCollesOrphelines", () => {
  it("décroche et efface les pids morts, épargne les vivants", async () => {
    const dead = writeFakeGlue(DEAD_PID, 1);
    const stillDead = writeFakeGlue(DEAD_PID, 2);
    const ours = writeFakeGlue(process.pid, 1);
    const aliveElsewhere = writeFakeGlue(process.ppid, 1);

    expect(await sweepOrphanGlue(root)).toBe(1);
    expect(existsSync(dead)).toBe(false);
    expect(existsSync(stillDead)).toBe(false);
    // Notre propre colle est peut-être POSÉE : la balayer la tuerait en vol.
    expect(existsSync(ours)).toBe(true);
    expect(existsSync(aliveElsewhere)).toBe(true);
    // Un seul décrochage pour les deux dossiers du même pid.
    expect(bridge.detached).toEqual([pluginName(DEAD_PID)]);
  });

  it("emporte l'ancien dossier partagé, que plus personne n'écrit", async () => {
    const previous = path.join(root, "tentacle-colle");
    mkdirSync(previous, { recursive: true });
    writeFileSync(path.join(previous, "colle-1234-abcdef.qml"), "// ancien", "utf8");

    expect(await sweepOrphanGlue(root)).toBe(0);
    expect(existsSync(previous)).toBe(false);
    // Ses greffons étaient anonymes : rien à décrocher, ils partiront avec KWin.
    expect(bridge.detached).toEqual([]);
  });

  it("racine illisible : zéro, sans jeter", async () => {
    await expect(sweepOrphanGlue(path.join(root, "absent"))).resolves.toBe(0);
  });
});

describe("retirerColleAuDepart", () => {
  it("décroche NOTRE greffon et n'efface que nos dossiers", () => {
    const ours = writeFakeGlue(process.pid, 1);
    const other = writeFakeGlue(DEAD_PID, 1);

    removeGlueAtStartup(root);

    expect(bridge.detached).toEqual([pluginName(process.pid)]);
    expect(existsSync(ours)).toBe(false);
    // Le départ n'est pas le moment du ménage général : c'est le rôle du
    // balayage, au lancement suivant, qui sait vérifier qu'un pid est mort.
    expect(existsSync(other)).toBe(true);
  });
});
