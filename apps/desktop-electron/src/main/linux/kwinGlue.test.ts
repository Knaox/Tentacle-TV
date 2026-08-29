import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";

/**
 * La colle KWin, sans KWin : le pont est joué. Ce qui se garde : le gabarit
 * porte le pid (l'appariement des fenêtres en dépend), ses types sont
 * QUALIFIÉS (un type nu se résout contre le dossier du fichier), chaque pose
 * écrit dans un dossier NEUF (le moteur QML de KWin est aveugle aux fichiers
 * apparus dans un dossier qu'il a déjà servi — mesuré), et le retrait ne
 * laisse rien derrière lui.
 */

const { bridge } = vi.hoisted(() => ({
  bridge: {
    filePaths: [] as string[],
    names: [] as (string | undefined)[],
    launched: [] as number[],
    detached: [] as string[],
    /** Les numéros rendus tour à tour ; le dernier vaut pour tous les suivants. */
    loadReturns: [0] as (number | null)[],
    runReturns: true,
  },
}));

vi.mock("./kwinScripting", () => ({
  loadDeclarativeScript: (filePath: string, name?: string) => {
    bridge.filePaths.push(filePath);
    bridge.names.push(name);
    const render = bridge.loadReturns.length > 1 ? bridge.loadReturns.shift() : bridge.loadReturns[0];
    return Promise.resolve(render ?? null);
  },
  runScript: (id: number) => {
    bridge.launched.push(id);
    return Promise.resolve(bridge.runReturns);
  },
  unloadScript: (name: string) => {
    bridge.detached.push(name);
    return Promise.resolve(true);
  },
  unloadScriptSync: (name: string) => {
    bridge.detached.push(name);
  },
}));

import { KwinGlue, glueTemplate } from "./kwinGlue";

beforeEach(() => {
  bridge.filePaths.length = 0;
  bridge.names.length = 0;
  bridge.launched.length = 0;
  bridge.detached.length = 0;
  bridge.loadReturns = [0];
  bridge.runReturns = true;
});

const PLUGIN_ID = `tentacle-colle-${String(process.pid)}`;

describe("gabaritColle", () => {
  it("inline le pid — l'appariement des fenêtres en dépend", () => {
    const qml = glueTemplate(4242);
    expect(qml).not.toContain("__PID__");
    expect(qml).toContain("w.pid !== 4242");
  });

  it("copie la géométrie et tient la paire par raiseWindow", () => {
    const qml = glueTemplate(1);
    expect(qml).toContain("Qt.rect(g.x, g.y, g.width, g.height)");
    expect(qml).toContain("Kwin.Workspace.raiseWindow(racine.video)");
    expect(qml).toContain("Kwin.Workspace.raiseWindow(racine.hote)");
  });

  it("qualifie TOUS ses types, l'objet attaché Component compris", () => {
    const qml = glueTemplate(1);
    expect(qml).toContain("import QtQml as Qml");
    expect(qml).toContain("import org.kde.kwin as Kwin");
    expect(qml).toContain("Qml.QtObject");
    expect(qml).toContain("Qml.Timer");
    // Nu, `Component.onCompleted` rend « Non-existent attached object » et le
    // composant entier meurt — mesuré au banc du 28.08.
    expect(qml).toContain("Qml.Component.onCompleted");
    expect(qml).not.toMatch(/(^|[^.])\bComponent\.onCompleted/m);
  });

  it("rejoue le premier coller par minuterie unique, jamais par le signal de la vidéo", () => {
    const qml = glueTemplate(1);
    // La minuterie one-shot, redémarrée à l'adoption de la fenêtre vidéo.
    expect(qml).toContain("Qml.Timer");
    expect(qml).toContain("repeat: false");
    expect(qml).toContain("racine.rattrapage.restart()");
    // Connecter frameGeometryChanged de la VIDÉO bouclerait : notre écriture
    // déclencherait le signal écouté. Seule la connexion de l'HÔTE existe.
    expect(qml.match(/frameGeometryChanged\.connect/g)?.length).toBe(1);
  });
});

describe("ColleKwin", () => {
  it("pose : un dossier neuf, le QML dedans, chargé et lancé", async () => {
    const glue = new KwinGlue();
    expect(await glue.apply()).toBe(true);
    expect(bridge.filePaths).toHaveLength(1);
    const filePath = bridge.filePaths[0] ?? "";
    // Un dossier PAR POSE : le moteur QML de KWin ne voit pas un fichier
    // apparu dans un dossier qu'il a déjà servi (« File name case mismatch »,
    // mesuré le 28.08 — la colle mourait dès le 2e lancement).
    expect(path.basename(filePath)).toBe("glue.qml");
    expect(path.basename(path.dirname(filePath))).toMatch(
      new RegExp(`^tentacle-colle-${String(process.pid)}-\\d+$`),
    );
    expect(existsSync(filePath)).toBe(true);
    expect(readFileSync(filePath, "utf8")).toBe(glueTemplate(process.pid));
    expect(bridge.launched).toEqual([0]);
    await glue.remove();
  });

  it("charge SOUS le greffon du processus, décroché d'abord", async () => {
    const glue = new KwinGlue();
    await glue.apply();
    // Une seule colle vivante par processus : KWin refuserait un nom déjà pris.
    expect(bridge.detached).toEqual([PLUGIN_ID]);
    expect(bridge.names).toEqual([PLUGIN_ID]);
    await glue.remove();
    expect(bridge.detached).toEqual([PLUGIN_ID, PLUGIN_ID]);
  });

  it("refus au chargement : une seconde tentative, une seule", async () => {
    // Le déchargement de KWin est différé : le nom peut n'être rendu qu'après.
    bridge.loadReturns = [null, 3];
    const glue = new KwinGlue();
    expect(await glue.apply()).toBe(true);
    expect(bridge.filePaths).toHaveLength(2);
    expect(bridge.launched).toEqual([3]);
    await glue.remove();

    bridge.filePaths.length = 0;
    bridge.loadReturns = [null, null];
    const stubborn = new KwinGlue();
    expect(await stubborn.apply()).toBe(false);
    expect(bridge.filePaths).toHaveLength(2);
    expect(existsSync(path.dirname(bridge.filePaths[0] ?? ""))).toBe(false);
  });

  it("deux poses ne partagent jamais un dossier", async () => {
    const a = new KwinGlue();
    const b = new KwinGlue();
    await a.apply();
    await b.apply();
    const [first, second] = bridge.filePaths;
    expect(path.dirname(first ?? "")).not.toBe(path.dirname(second ?? ""));
    await a.remove();
    await b.remove();
  });

  it("retire : décroche le greffon et efface le DOSSIER, pas seulement le fichier", async () => {
    const glue = new KwinGlue();
    await glue.apply();
    const filePath = bridge.filePaths[0] ?? "";
    await glue.remove();
    expect(bridge.detached).toEqual([PLUGIN_ID, PLUGIN_ID]);
    expect(existsSync(filePath)).toBe(false);
    expect(existsSync(path.dirname(filePath))).toBe(false);
    // Un second retrait ne refait rien : la colle est déjà levée.
    await glue.remove();
    expect(bridge.detached).toEqual([PLUGIN_ID, PLUGIN_ID]);
  });

  it("pose refusée par KWin : faux, et aucun dossier orphelin", async () => {
    bridge.loadReturns = [null];
    const glue = new KwinGlue();
    expect(await glue.apply()).toBe(false);
    const filePath = bridge.filePaths[0] ?? "";
    expect(existsSync(path.dirname(filePath))).toBe(false);
  });
});
