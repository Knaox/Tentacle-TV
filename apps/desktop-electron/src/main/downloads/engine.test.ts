/**
 * L'orchestrateur : deux transferts à la fois, et surtout la traduction d'une
 * fin de transfert en statut.
 *
 * Celle qui compte : une coupure réseau devient une pause SYSTÈME, donc reprise
 * automatique au retour. La marquer `error` demanderait un geste à
 * l'utilisateur pour un incident qui se résout tout seul — et c'est invisible
 * tant qu'on n'a pas coupé le réseau au bon moment.
 *
 * Ce qui touche à l'ARRIÈRE-PLAN — bascule d'activité, reprise des pauses
 * système, comptage pour la garde de sortie — vit dans `engineActivity.test.ts`.
 */

import { describe, expect, it, vi } from "vitest";
import { openInMemory } from "./db";
import { MAX_PARALLEL } from "./engine";
import { getFile } from "./queue";
import { CREDS, makeEngine, rootWithThreeItems, immediateNet, heldNet, seed } from "./testkit";

describe("parallelisme", () => {
  it("n'ouvre jamais plus de deux transferts a la fois", async () => {
    const db = openInMemory();
    const root = rootWithThreeItems();
    seed(db, "item1", 1_000);
    seed(db, "item2", 2_000);
    const third = seed(db, "item3", 3_000);
    const held = heldNet();
    const { engine } = makeEngine(db, root, held.net);

    engine.start(CREDS);
    // Un tour de boucle complet : le worker passe par plusieurs `await` avant
    // d'ouvrir son flux (snapshot, nettoyage du `.part`).
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(held.opened).toBe(MAX_PARALLEL);
    // Le troisieme reste en file tant qu'une place ne se libere pas.
    expect(getFile(db, third)?.status).toBe("queued");
    held.release();
  });
});

describe("traduction des fins de transfert", () => {
  it("un transfert reussi passe en complete et libere la place", async () => {
    const db = openInMemory();
    const root = rootWithThreeItems();
    const first = seed(db, "item1", 1_000);
    const second = seed(db, "item2", 2_000);
    const { engine, events } = makeEngine(db, root, immediateNet(200));

    engine.start(CREDS);
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(getFile(db, first)?.status).toBe("complete");
    expect(getFile(db, second)?.status).toBe("complete");
    expect(events).toContain("downloads://changed");
  });

  it("une coupure reseau devient une pause SYSTEME, pas une erreur", async () => {
    const db = openInMemory();
    const root = rootWithThreeItems();
    const fileId = seed(db, "item1", 1_000);
    const { engine } = makeEngine(db, root, immediateNet(502));

    engine.start(CREDS);
    await new Promise((resolve) => setTimeout(resolve, 30));

    const file = getFile(db, fileId);
    expect(file?.status).toBe("paused");
    expect(file?.errorCode).toBeNull();
    // paused_by_user reste a 0 : la normalisation au prochain demarrage, ou le
    // reveil de veille, remettront le transfert en file tout seuls.
    const raw = db.prepare("SELECT paused_by_user AS p FROM files WHERE id = ?").get(fileId);
    expect(Number(raw?.["p"])).toBe(0);
  });

  it("un media absent du serveur devient une erreur, pas une pause", async () => {
    const db = openInMemory();
    const root = rootWithThreeItems();
    const fileId = seed(db, "item1", 1_000);
    const { engine } = makeEngine(db, root, immediateNet(404));

    engine.start(CREDS);
    await new Promise((resolve) => setTimeout(resolve, 30));

    const file = getFile(db, fileId);
    expect(file?.status).toBe("error");
    expect(file?.errorCode).toBe("unavailable");
  });
});

describe("gestes de l'utilisateur", () => {
  it("mettre en pause un transfert encore en file le sort de la file", async () => {
    const db = openInMemory();
    const root = rootWithThreeItems();
    seed(db, "item1", 1_000);
    seed(db, "item2", 2_000);
    const third = seed(db, "item3", 3_000);
    const held = heldNet();
    const { engine } = makeEngine(db, root, held.net);
    engine.start(CREDS);
    await Promise.resolve();

    engine.pause(third);

    expect(getFile(db, third)?.status).toBe("paused");
    const raw = db.prepare("SELECT paused_by_user AS p FROM files WHERE id = ?").get(third);
    // Pause EXPLICITE : elle survivra au redemarrage.
    expect(Number(raw?.["p"])).toBe(1);
    held.release();
    // `release` relance la CASCADE (item1 finit, item2 s'enchaîne) : rendre la
    // main en pleine écriture faisait courir le moteur contre le `rmSync` du
    // kit — ENOTEMPTY intermittent quand un fichier naissait sous `media/`
    // pendant la marche récursive (vu le 28.08, suite complète chargée).
    await vi.waitFor(() => {
      expect(engine.pending()).toBe(0);
    });
  });

  it("reprendre remet en file et relance", async () => {
    const db = openInMemory();
    const root = rootWithThreeItems();
    const fileId = seed(db, "item1", 1_000);
    const { engine } = makeEngine(db, root, immediateNet(502));
    engine.start(CREDS);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(getFile(db, fileId)?.status).toBe("paused");

    engine.resume(fileId);
    await new Promise((resolve) => setTimeout(resolve, 30));

    // Le reseau est toujours coupe : il repasse en pause, mais il a bien
    // ete relance.
    expect(getFile(db, fileId)?.status).toBe("paused");
  });

  it("annuler un transfert qui n'a pas demarre le marque annule", () => {
    const db = openInMemory();
    const root = rootWithThreeItems();
    const fileId = seed(db, "item1", 1_000);
    const { engine } = makeEngine(db, root, immediateNet(200));

    engine.cancel(fileId);

    expect(getFile(db, fileId)?.status).toBe("canceled");
    expect(getFile(db, fileId)?.bytesDone).toBe(0);
  });

  it("sans identifiants, le moteur ne lance rien", () => {
    const db = openInMemory();
    const root = rootWithThreeItems();
    const fileId = seed(db, "item1", 1_000);
    const { engine } = makeEngine(db, root, immediateNet(200));

    engine.pump();

    expect(getFile(db, fileId)?.status).toBe("queued");
  });
});
