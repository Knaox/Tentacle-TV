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
    expect(qml).toContain("Kwin.Workspace.raiseWindow(root.video)");
    expect(qml).toContain("Kwin.Workspace.raiseWindow(root.host)");
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
    expect(qml).toContain("Qml.Component.onDestruction");
    expect(qml).not.toMatch(/(^|[^.])\bComponent\.onDestruction/m);
  });

  it("monte la vidéo d'une couche, et SEULEMENT sous un hôte plein écran actif", () => {
    const qml = glueTemplate(1);
    // Le panneau du bureau passe devant une fenêtre ordinaire : en plein écran,
    // il s'intercalait entre mpv et notre fenêtre transparente, donc se voyait.
    expect(qml).toContain(
      "root.video.keepAbove = root.host.keepAbove || (root.host.fullScreen && root.host.active)",
    );
    expect(qml).toContain("w.fullScreenChanged.connect(root.followLayer)");
    // Sans la condition d'activation, un hôte plein écran qui perd le focus
    // retombe en couche normale et la vidéo recouvrirait TOUT le bureau.
    expect(qml).not.toContain("root.video.keepAbove = true");
  });

  it("passe la vidéo en plein écran AVEC l'hôte — la règle de KWin vaut écran par écran", () => {
    const qml = glueTemplate(1);
    // KWin garde un plein écran en couche « active » tant que la fenêtre active
    // est sur un AUTRE écran : la vidéo doit y être soumise elle aussi, sinon le
    // panneau et les notifications s'intercalent (banc du 09.10.2026).
    expect(qml).toContain("root.video.fullScreen = root.host.fullScreen;");
    // Plein écran, la géométrie est celle de l'écran : on ne la recopie pas.
    expect(qml).toContain("if (!root.video.fullScreen) {");
    // La sortie est accusée par mpv APRÈS celle de l'hôte : on recolle alors.
    expect(qml).toContain("w.fullScreenChanged.connect(root.videoFullScreenChanged)");
    expect(qml).toContain("root.video.fullScreenChanged.disconnect(root.videoFullScreenChanged)");
    // Décrochée, la colle rend la vidéo fenêtrée.
    expect(qml).toContain("root.video.fullScreen = false;");
  });

  it("défait à la destruction TOUT ce que take() a noué — les gestionnaires morts", () => {
    const qml = glueTemplate(1);
    // 2 827 « TypeError: Cannot read property 'hote' of null » au journal de
    // KWin en sept jours (17.09.2026) : les connexions survivaient à l'instance.
    expect(qml).toContain("Qml.Component.onDestruction: root.release()");
    expect(qml).toContain("Kwin.Workspace.windowAdded.disconnect(root.take)");
    expect(qml).toContain("root.host.frameGeometryChanged.disconnect(root.glue)");
    expect(qml).toContain("root.host.activeChanged.disconnect(root.followLayer)");
    expect(qml).toContain("root.host.closed.disconnect(root.hostClosed)");
    expect(qml).toContain("root.video.closed.disconnect(root.videoClosed)");
    expect(qml).toContain("root.video.activeChanged.disconnect(root.reclaimActivation)");
    expect(qml).toContain("root.video.minimizedChanged.disconnect(root.followVideoMinimized)");
    expect(qml).toContain("root.video.captionNormalChanged.disconnect(root.followSwitcher)");
    expect(qml).toContain("root.host.keepAboveChanged.disconnect(root.followLayer)");
    expect(qml).toContain("root.host.keepBelowChanged.disconnect(root.followLayer)");
    expect(qml).toContain("root.host.minimizedChanged.disconnect(root.followMinimized)");
    expect(qml).toContain("root.host.desktopsChanged.disconnect(root.followDesktops)");
    expect(qml).toContain("root.host.activitiesChanged.disconnect(root.followActivities)");
    // Chaque connexion a sa déconnexion : même nombre des deux côtés.
    expect(qml.match(/\.connect\(root\./g)?.length).toBe(qml.match(/\.disconnect\(root\./g)?.length);
    // Une fermeture anonyme ne se déconnecte pas : plus aucune dans le gabarit.
    expect(qml).not.toContain("connect(function");
    // Et la couche est rendue AVANT de lâcher la fenêtre.
    expect(qml).toContain("root.video.keepAbove = false;");
  });

  it("ne rend JAMAIS l'activation à un hôte réduit — la réduction s'annulait elle-même", () => {
    const qml = glueTemplate(1);
    // KWin passe le focus à mpv PENDANT la réduction de l'hôte, et
    // activateWindow dé-réduit ce qu'il active (sources de KWin 6.7).
    const body = qml.slice(qml.indexOf("function reclaimActivation()"), qml.indexOf("function minimizeWithHost()"));
    expect(body.indexOf("if (root.host.minimized)")).toBeGreaterThan(-1);
    expect(body.indexOf("if (root.host.minimized)")).toBeLessThan(
      body.indexOf("Kwin.Workspace.activeWindow = root.host"),
    );
    // La vidéo est réduite un tour de boucle plus tard, hors de la pile de KWin.
    expect(body).toContain("root.minimizeLater.restart()");
    expect(qml).toContain("interval: 0");
    expect(qml).toContain("root.video.minimized = true");
  });

  it("la vidéo rendue à l'écran ramène l'hôte ; l'hôte réduit emmène la vidéo", () => {
    const qml = glueTemplate(1);
    expect(qml).toContain("w.minimizedChanged.connect(root.followVideoMinimized)");
    expect(qml).toContain("if (!root.video.minimized && root.host.minimized) root.host.minimized = false");
    expect(qml).toContain("w.minimizedChanged.connect(root.followMinimized)");
    expect(qml).toContain("root.video.minimized = root.host.minimized");
  });

  it("suit les bureaux virtuels et les activités de l'hôte", () => {
    const qml = glueTemplate(1);
    expect(qml).toContain("root.video.desktops = root.host.desktops");
    expect(qml).toContain("root.video.activities = root.host.activities");
    expect(qml).toContain("w.desktopsChanged.connect(root.followDesktops)");
    expect(qml).toContain("w.activitiesChanged.connect(root.followActivities)");
  });

  it("Alt+Tab : la vidéo représente l'application pendant la lecture, l'hôte sinon", () => {
    const qml = glueTemplate(1);
    // La vignette du sélecteur ne rend qu'UNE fenêtre : celle de l'hôte est
    // transparente là où la vidéo se trouve.
    expect(qml).toContain('var playing = root.video !== null && root.video.captionNormal !== "";');
    expect(qml).toContain("root.video.skipSwitcher = !playing;");
    expect(qml).toContain("root.host.skipSwitcher = playing;");
    expect(qml).toContain("w.captionNormalChanged.connect(root.followSwitcher)");
    // La vidéo fermée rend sa place à l'hôte, la colle décrochée aussi.
    expect(qml).toMatch(/function videoClosed\(\) \{\s+root\.video = null;\s+root\.followSwitcher\(\);/);
    expect(qml).toContain("root.host.skipSwitcher = false;");
  });

  it("reconnaît la vidéo par son app-id, inliné en littéral JSON — « mpv » reste accepté", () => {
    const appId = '/home/a b/.config/Tentacle "TV"/video-window/tentacle-tv-video';
    const qml = glueTemplate(1, appId);
    expect(qml).not.toContain("__VIDEO_CLASS__");
    expect(qml).toContain(`w.resourceClass === "mpv" || w.resourceClass === ${JSON.stringify(appId)}`);
    expect(glueTemplate(1)).toContain('w.resourceClass === "mpv" || w.resourceClass === "mpv"');
  });

  it("reste un QML bien parenthésé — aucun reste de gabarit", () => {
    const qml = glueTemplate(4242, "/x/tentacle-tv-video");
    const count = (c: string) => qml.split(c).length - 1;
    expect(count("{")).toBe(count("}"));
    expect(count("(")).toBe(count(")"));
    expect(qml).not.toContain("${");
    expect(qml).not.toMatch(/__[A-Z_]+__/);
  });

  it("rejoue le premier coller par minuterie unique, jamais par le signal de la vidéo", () => {
    const qml = glueTemplate(1);
    // La minuterie one-shot, redémarrée à l'adoption de la fenêtre vidéo.
    expect(qml).toContain("Qml.Timer");
    expect(qml).toContain("repeat: false");
    expect(qml).toContain("root.catchUp.restart()");
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
