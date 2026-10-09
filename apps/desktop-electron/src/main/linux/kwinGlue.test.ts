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
import { PIP_CAPTIONS, PIP_MARGIN, pipCaption } from "../pip/pipCaptions";
import { PIP_FRAME, PIP_INSET } from "../pip/pipFrame";

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
    expect(qml).toContain("root.host.frameGeometryChanged.disconnect(root.hostMoved)");
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
    // Chaque connexion a sa déconnexion — le même signal et le même gestionnaire.
    const pairs = (verb: string) =>
      new Set([...qml.matchAll(new RegExp(`\\.(\\w+)\\.${verb}\\(root\\.(\\w+)\\)`, "g"))].map((m) => `${m[1]}→${m[2]}`));
    expect([...pairs("connect")].sort()).toEqual([...pairs("disconnect")].sort());
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
    expect(qml).toContain("var activities = root.floating() ? [] : root.host.activities;");
    expect(qml).toContain("root.video.activities = activities;");
    expect(qml).toContain("w.desktopsChanged.connect(root.followDesktops)");
    expect(qml).toContain("w.activitiesChanged.connect(root.followActivities)");
  });

  it("Alt+Tab : la vidéo représente l'application pendant la lecture, l'hôte sinon", () => {
    const qml = glueTemplate(1);
    // La vignette du sélecteur ne rend qu'UNE fenêtre : celle de l'hôte est
    // transparente là où la vidéo se trouve.
    // En PiP, l'hôte redevient une fenêtre d'application ordinaire.
    expect(qml).toContain('var playing = root.video !== null && root.video.captionNormal !== "" && root.pip === null;');
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
    // déclencherait le signal écouté. Seuls l'HÔTE et le PiP sont écoutés.
    expect([...qml.matchAll(/frameGeometryChanged\.connect\(root\.(\w+)\)/g)].map((m) => m[1]).sort()).toEqual([
      "hostMoved",
      "pipMoved",
    ]);
    const videoBranch = qml.slice(qml.indexOf("if (root.isVideo(w)) {"), qml.indexOf("root.catchUp.restart()"));
    expect(videoBranch).not.toContain("frameGeometryChanged");
  });
});

describe("gabaritColle — le PiP", () => {
  it("reconnaît la fenêtre PiP à son titre, inliné en littéral JSON — et l'écoute changer", () => {
    const qml = glueTemplate(1);
    const modeOf = qml.slice(qml.indexOf("function modeOf(w)"), qml.indexOf("function floating()"));
    expect(modeOf).toContain(`if (c === ${JSON.stringify(PIP_CAPTIONS.floating)}) return "floating";`);
    expect(modeOf).toContain(`if (c === ${JSON.stringify(PIP_CAPTIONS.docked)}) return "docked";`);
    // Le geste en cours, accolé au titre, ne change pas le mode.
    expect(modeOf).toContain(`var k = c.indexOf(${JSON.stringify(" [")});`);
    expect(pipCaption("floating", "move")).toBe(`${PIP_CAPTIONS.floating} [move]`);
    // Le titre bascule le mode, et peut arriver après la fenêtre.
    expect(qml).toContain("w.captionNormalChanged.connect(root.captionChanged)");
  });

  it("la vidéo suit le PiP à la place de l'hôte, et ne relève la paire que flottante", () => {
    const qml = glueTemplate(1);
    const glue = qml.slice(qml.indexOf("function glue()"), qml.indexOf("function wantedConstraints()"));
    expect(glue).toContain("var p = root.pip.frameGeometry;");
    // DANS le cadre : le liseré de la page recouvre les coins carrés de mpv.
    expect(glue).toContain(`var i = ${String(PIP_INSET)};`);
    expect(glue).toContain("root.video.frameGeometry = Qt.rect(p.x + i, p.y + i, p.width - 2 * i, p.height - 2 * i);");
    // Ancré, relever la paire la ferait passer devant une fenêtre qui recouvre l'application.
    expect(glue).toContain("if (root.floating()) {");
  });

  it("tient hôte < vidéo < PiP par les contraintes de KWin, et les lève au lâcher", () => {
    const qml = glueTemplate(1);
    expect(qml).toContain("return [[root.host, root.video], [root.video, root.pip]];");
    // Sans PiP : jamais l'interface sous la vidéo.
    expect(qml).toContain("return [[root.video, root.host]];");
    // Avant KWin 6.5, la fonction n'existe pas : l'appel est gardé.
    expect(qml).toContain("try { Kwin.Workspace.constrain(wanted[k][0], wanted[k][1]); kept.push(wanted[k]); } catch (e) { }");
    const release = qml.slice(qml.indexOf("function release()"));
    expect(release).toContain("Kwin.Workspace.unconstrain(root.constraints[c][0], root.constraints[c][1])");
  });

  it("flottant : au-dessus de tout, sur tous les bureaux, épargné par la réduction de l'application", () => {
    const qml = glueTemplate(1);
    expect(qml).toContain("root.pip.keepAbove = root.floating() || root.host.keepAbove;");
    expect(qml).toContain("root.video.keepAbove = root.pip.keepAbove;");
    expect(qml).toContain("root.pip.onAllDesktops = true;");
    const minimize = qml.slice(qml.indexOf("function minimizeWithHost()"), qml.indexOf("function followMinimized()"));
    expect(minimize).toContain("root.floating()");
  });

  it("se range au coin bas-droit — de l'écran s'il flotte, de la zone client s'il est ancré", () => {
    const qml = glueTemplate(1);
    // La marge se compte au cadre VISIBLE : l'ombre déborde.
    expect(qml).toContain(`var m = ${String(PIP_MARGIN)} - ${String(PIP_FRAME.shadow)};`);
    expect(qml).toContain("root.floating() ? root.workArea(root.host.output) : root.host.clientGeometry");
    // Une taille changée garde fixe le coin le plus proche du bord, jamais
    // pendant un geste — de KWin ou de la page, qui place la fenêtre lui-même.
    expect(qml).toContain('if (resized && root.pipGesture === "" && !root.pip.move && !root.pip.resize) {');
  });

  it("rend la main au PiP flottant quand la vidéo est activée", () => {
    const qml = glueTemplate(1);
    const body = qml.slice(qml.indexOf("function reclaimActivation()"), qml.indexOf("function minimizeWithHost()"));
    expect(body.indexOf("Kwin.Workspace.activeWindow = root.pip")).toBeGreaterThan(-1);
    expect(body.indexOf("Kwin.Workspace.activeWindow = root.pip")).toBeLessThan(
      body.indexOf("Kwin.Workspace.activeWindow = root.host"),
    );
  });

  it("suit le geste annoncé dans le titre, et seulement lui", () => {
    const qml = glueTemplate(1);
    const gestureOf = qml.slice(qml.indexOf("function gestureOf(w)"), qml.indexOf("function endGesture()"));
    expect(gestureOf).toContain(`var open = ${JSON.stringify(" [")};`);
    expect(gestureOf).toContain(`var close = ${JSON.stringify("]")};`);
    // Le titre suivi : le geste commence, change ou cesse avec lui.
    expect(qml).toContain("if (w === root.pip && root.modeOf(w) === root.pipMode) { root.followGesture(); continue; }");
    const follow = qml.slice(qml.indexOf("function followGesture()"), qml.indexOf("function followCursor()"));
    expect(follow).toContain("Kwin.Workspace.cursorPosChanged.connect(root.followCursor);");
    // Ancré, le PiP est le coin de l'application : il ne se glisse pas.
    expect(follow).toContain('(gesture.indexOf("move") === 0 && !root.floating())');
    // Glisser garde le point saisi sous le curseur.
    expect(follow).toContain("if (isFinite(gx) && isFinite(gy)) c = Qt.point(g.x + gx, g.y + gy);");
    expect(pipCaption("floating", "move", { x: 162.4, y: 101.6 })).toBe(`${PIP_CAPTIONS.floating} [move 162 102]`);
    expect(pipCaption("docked", "top-left", { x: 3, y: 4 })).toBe(`${PIP_CAPTIONS.docked} [top-left]`);
    // Un PiP fermé emporte son geste, et le greffon décroché aussi : un
    // gestionnaire de Workspace survit au greffon qui l'a posé.
    const closed = qml.slice(qml.indexOf("function pipClosed()"));
    expect(closed).toContain("root.endGesture();");
    const release = qml.slice(qml.indexOf("function release()"), qml.indexOf("var ws = Kwin.Workspace.windows;", qml.indexOf("function release()")));
    expect(release).toContain("root.endGesture();");
    const end = qml.slice(qml.indexOf("function endGesture()"), qml.indexOf("function followGesture()"));
    expect(end).toContain("Kwin.Workspace.cursorPosChanged.disconnect(root.followCursor);");
  });

  it("glisser garde le cadre visible dans la zone utile de l'écran sous le curseur ; tirer un coin garde le coin opposé", () => {
    const qml = glueTemplate(1);
    const drag = qml.slice(qml.indexOf("function dragPip(s, cursor)"), qml.indexOf("function stretchPip("));
    expect(drag).toContain("Kwin.Workspace.screenAt(cursor)");
    expect(drag).toContain(`var sh = ${String(PIP_FRAME.shadow)};`);
    const stretch = qml.slice(qml.indexOf("function stretchPip("));
    expect(stretch).toContain("root.pipRect = Qt.rect(left ? s.x + s.width - w : s.x, top ? s.y + s.height - h : s.y, w, h);");
    expect(stretch).toContain("var aspect = w0 / h0;");
  });

  it("aucune fonction ne porte le nom du signal qu'engendre une propriété — le composant ne se chargerait pas", () => {
    const qml = glueTemplate(1);
    // « Duplicate method name: invalid override of property change signal » au
    // journal de KWin, et plus de colle du tout (banc du 09.10.2026).
    const properties = [...qml.matchAll(/^\s*property \w+ (\w+):/gm)].map((m) => m[1] ?? "");
    expect(properties).toContain("pip");
    for (const name of properties) expect(qml).not.toContain(`function ${name}Changed(`);
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
