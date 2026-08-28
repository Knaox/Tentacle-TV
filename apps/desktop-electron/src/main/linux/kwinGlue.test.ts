import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";

/**
 * La colle KWin, sans KWin : le pont est joué. Ce qui se garde : le gabarit
 * porte le pid (l'appariement des fenêtres en dépend), le chemin porte un
 * hachage du contenu (le cache QML de KWin sert l'ancien code sinon — mesuré),
 * et la pose comme le retrait nettoient leurs traces.
 */

const { pont } = vi.hoisted(() => ({
  pont: {
    chemins: [] as string[],
    lances: [] as number[],
    arretes: [] as number[],
    chargerRend: 0 as number | null,
    lancerRend: true,
  },
}));

vi.mock("./kwinScripting", () => ({
  chargerScriptDeclaratif: (chemin: string) => {
    pont.chemins.push(chemin);
    return Promise.resolve(pont.chargerRend);
  },
  lancerScript: (id: number) => {
    pont.lances.push(id);
    return Promise.resolve(pont.lancerRend);
  },
  arreterScript: (id: number) => {
    pont.arretes.push(id);
    return Promise.resolve(true);
  },
}));

import { ColleKwin, gabaritColle } from "./kwinGlue";

beforeEach(() => {
  pont.chemins.length = 0;
  pont.lances.length = 0;
  pont.arretes.length = 0;
  pont.chargerRend = 0;
  pont.lancerRend = true;
});

describe("gabaritColle", () => {
  it("inline le pid — l'appariement des fenêtres en dépend", () => {
    const qml = gabaritColle(4242);
    expect(qml).not.toContain("__PID__");
    expect(qml).toContain("w.pid !== 4242");
  });

  it("copie la géométrie et tient la paire par raiseWindow", () => {
    const qml = gabaritColle(1);
    expect(qml).toContain("Qt.rect(g.x, g.y, g.width, g.height)");
    expect(qml).toContain("Workspace.raiseWindow(racine.video)");
    expect(qml).toContain("Workspace.raiseWindow(racine.hote)");
  });

  it("rejoue le premier coller par minuterie unique, jamais par le signal de la vidéo", () => {
    const qml = gabaritColle(1);
    // La minuterie one-shot, redémarrée à l'adoption de la fenêtre vidéo.
    expect(qml).toContain("Timer");
    expect(qml).toContain("repeat: false");
    expect(qml).toContain("racine.rattrapage.restart()");
    // Connecter frameGeometryChanged de la VIDÉO bouclerait : notre écriture
    // déclencherait le signal écouté. Seule la connexion de l'HÔTE existe.
    expect(qml.match(/frameGeometryChanged\.connect/g)?.length).toBe(1);
  });
});

describe("ColleKwin", () => {
  it("pose : écrit le QML (pid + hachage dans le nom), charge, lance", async () => {
    const colle = new ColleKwin();
    expect(await colle.poser()).toBe(true);
    expect(pont.chemins).toHaveLength(1);
    const chemin = pont.chemins[0] ?? "";
    // Sous-dossier PRIVÉ, jamais la racine de /tmp : le répertoire du fichier
    // a priorité dans la résolution des types QML, et un fichier parasite de
    // /tmp a déjà tué la colle entière (« File name case mismatch », 28.08).
    expect(chemin).toContain(`tentacle-colle${path.sep}colle-${String(process.pid)}-`);
    expect(chemin.endsWith(".qml")).toBe(true);
    expect(existsSync(chemin)).toBe(true);
    expect(readFileSync(chemin, "utf8")).toBe(gabaritColle(process.pid));
    expect(pont.lances).toEqual([0]);
    await colle.retirer();
  });

  it("retire : arrête le script et efface le fichier", async () => {
    const colle = new ColleKwin();
    await colle.poser();
    const chemin = pont.chemins[0] ?? "";
    await colle.retirer();
    expect(pont.arretes).toEqual([0]);
    expect(existsSync(chemin)).toBe(false);
    // Un second retrait ne refait rien : la colle est déjà levée.
    await colle.retirer();
    expect(pont.arretes).toEqual([0]);
  });

  it("pose refusée par KWin : faux, et aucun fichier orphelin", async () => {
    pont.chargerRend = null;
    const colle = new ColleKwin();
    expect(await colle.poser()).toBe(false);
    const chemin = pont.chemins[0] ?? "";
    expect(existsSync(chemin)).toBe(false);
  });
});
