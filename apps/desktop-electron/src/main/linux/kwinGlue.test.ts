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

const { pont } = vi.hoisted(() => ({
  pont: {
    chemins: [] as string[],
    noms: [] as (string | undefined)[],
    lances: [] as number[],
    decroches: [] as string[],
    /** Les numéros rendus tour à tour ; le dernier vaut pour tous les suivants. */
    chargerRend: [0] as (number | null)[],
    lancerRend: true,
  },
}));

vi.mock("./kwinScripting", () => ({
  chargerScriptDeclaratif: (chemin: string, nom?: string) => {
    pont.chemins.push(chemin);
    pont.noms.push(nom);
    const rendu = pont.chargerRend.length > 1 ? pont.chargerRend.shift() : pont.chargerRend[0];
    return Promise.resolve(rendu ?? null);
  },
  lancerScript: (id: number) => {
    pont.lances.push(id);
    return Promise.resolve(pont.lancerRend);
  },
  dechargerScript: (nom: string) => {
    pont.decroches.push(nom);
    return Promise.resolve(true);
  },
  dechargerScriptSync: (nom: string) => {
    pont.decroches.push(nom);
  },
}));

import { ColleKwin, gabaritColle } from "./kwinGlue";

beforeEach(() => {
  pont.chemins.length = 0;
  pont.noms.length = 0;
  pont.lances.length = 0;
  pont.decroches.length = 0;
  pont.chargerRend = [0];
  pont.lancerRend = true;
});

const GREFFON = `tentacle-colle-${String(process.pid)}`;

describe("gabaritColle", () => {
  it("inline le pid — l'appariement des fenêtres en dépend", () => {
    const qml = gabaritColle(4242);
    expect(qml).not.toContain("__PID__");
    expect(qml).toContain("w.pid !== 4242");
  });

  it("copie la géométrie et tient la paire par raiseWindow", () => {
    const qml = gabaritColle(1);
    expect(qml).toContain("Qt.rect(g.x, g.y, g.width, g.height)");
    expect(qml).toContain("Kwin.Workspace.raiseWindow(racine.video)");
    expect(qml).toContain("Kwin.Workspace.raiseWindow(racine.hote)");
  });

  it("qualifie TOUS ses types, l'objet attaché Component compris", () => {
    const qml = gabaritColle(1);
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
    const qml = gabaritColle(1);
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
    const colle = new ColleKwin();
    expect(await colle.poser()).toBe(true);
    expect(pont.chemins).toHaveLength(1);
    const chemin = pont.chemins[0] ?? "";
    // Un dossier PAR POSE : le moteur QML de KWin ne voit pas un fichier
    // apparu dans un dossier qu'il a déjà servi (« File name case mismatch »,
    // mesuré le 28.08 — la colle mourait dès le 2e lancement).
    expect(path.basename(chemin)).toBe("glue.qml");
    expect(path.basename(path.dirname(chemin))).toMatch(
      new RegExp(`^tentacle-colle-${String(process.pid)}-\\d+$`),
    );
    expect(existsSync(chemin)).toBe(true);
    expect(readFileSync(chemin, "utf8")).toBe(gabaritColle(process.pid));
    expect(pont.lances).toEqual([0]);
    await colle.retirer();
  });

  it("charge SOUS le greffon du processus, décroché d'abord", async () => {
    const colle = new ColleKwin();
    await colle.poser();
    // Une seule colle vivante par processus : KWin refuserait un nom déjà pris.
    expect(pont.decroches).toEqual([GREFFON]);
    expect(pont.noms).toEqual([GREFFON]);
    await colle.retirer();
    expect(pont.decroches).toEqual([GREFFON, GREFFON]);
  });

  it("refus au chargement : une seconde tentative, une seule", async () => {
    // Le déchargement de KWin est différé : le nom peut n'être rendu qu'après.
    pont.chargerRend = [null, 3];
    const colle = new ColleKwin();
    expect(await colle.poser()).toBe(true);
    expect(pont.chemins).toHaveLength(2);
    expect(pont.lances).toEqual([3]);
    await colle.retirer();

    pont.chemins.length = 0;
    pont.chargerRend = [null, null];
    const obstinee = new ColleKwin();
    expect(await obstinee.poser()).toBe(false);
    expect(pont.chemins).toHaveLength(2);
    expect(existsSync(path.dirname(pont.chemins[0] ?? ""))).toBe(false);
  });

  it("deux poses ne partagent jamais un dossier", async () => {
    const a = new ColleKwin();
    const b = new ColleKwin();
    await a.poser();
    await b.poser();
    const [premier, second] = pont.chemins;
    expect(path.dirname(premier ?? "")).not.toBe(path.dirname(second ?? ""));
    await a.retirer();
    await b.retirer();
  });

  it("retire : décroche le greffon et efface le DOSSIER, pas seulement le fichier", async () => {
    const colle = new ColleKwin();
    await colle.poser();
    const chemin = pont.chemins[0] ?? "";
    await colle.retirer();
    expect(pont.decroches).toEqual([GREFFON, GREFFON]);
    expect(existsSync(chemin)).toBe(false);
    expect(existsSync(path.dirname(chemin))).toBe(false);
    // Un second retrait ne refait rien : la colle est déjà levée.
    await colle.retirer();
    expect(pont.decroches).toEqual([GREFFON, GREFFON]);
  });

  it("pose refusée par KWin : faux, et aucun dossier orphelin", async () => {
    pont.chargerRend = [null];
    const colle = new ColleKwin();
    expect(await colle.poser()).toBe(false);
    const chemin = pont.chemins[0] ?? "";
    expect(existsSync(path.dirname(chemin))).toBe(false);
  });
});
