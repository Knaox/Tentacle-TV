/**
 * L'orchestrateur : un seul transfert à la fois, et surtout la traduction d'une
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
import { openInMemory } from "../node/nodeDatabase";
import { MAX_PARALLEL } from "./engine";
import { getFile } from "./queue";
import fs from "node:fs";
import path from "node:path";
import { claimOrCreateFile } from "./store";
import type { TransferNet } from "./transferNet";
import { CREDS, makeEngine, rootWithThreeItems, immediateNet, heldNet, seed, spec, writeMedia } from "./testkit";

describe("parallelisme", () => {
  it("n'ouvre qu'un seul transfert a la fois", async () => {
    const db = openInMemory();
    const root = rootWithThreeItems();
    seed(db, "item1", 1_000);
    const second = seed(db, "item2", 2_000);
    const third = seed(db, "item3", 3_000);
    const held = heldNet();
    const { engine } = makeEngine(db, root, held.net);

    engine.start(CREDS);
    // Un tour de boucle complet : le worker passe par plusieurs `await` avant
    // d'ouvrir son flux (snapshot, nettoyage du `.part`).
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(held.opened).toBe(MAX_PARALLEL);
    // Les suivants restent en file tant que la place ne se libere pas.
    expect(getFile(db, second)?.status).toBe("queued");
    expect(getFile(db, third)?.status).toBe("queued");
    held.release();
  });

  it("la plateforme peut ouvrir plusieurs places, le temps d'une suspension", async () => {
    const db = openInMemory();
    const root = rootWithThreeItems();
    seed(db, "item1", 1_000);
    seed(db, "item2", 2_000);
    seed(db, "item3", 3_000);
    const held = heldNet();
    // iPhone verrouille : ce qui n'est pas parti avant la suspension ne
    // partira pas du tout, le JavaScript ne lancant plus rien.
    const { engine } = makeEngine(db, root, held.net, { parallelLimit: () => 3 });

    engine.start(CREDS);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(held.opened).toBe(3);
    held.release();
  });

  it("la demande est bornee : on ne sature pas la connexion", async () => {
    const db = openInMemory();
    const root = rootWithThreeItems();
    seed(db, "item1", 1_000);
    seed(db, "item2", 2_000);
    seed(db, "item3", 3_000);
    const held = heldNet();
    const { engine } = makeEngine(db, root, held.net, { parallelLimit: () => 99 });

    engine.start(CREDS);
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Trois fichiers seulement en file : le plafond n'en invente pas.
    expect(held.opened).toBe(3);
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
    // Les deux se suivent : le second ne part que quand le premier a libere la
    // place, d'ou l'attente sur le resultat plutot qu'un delai fixe.
    await vi.waitFor(() => {
      expect(getFile(db, second)?.status).toBe("complete");
    });

    expect(getFile(db, first)?.status).toBe("complete");
    expect(events).toContain("downloads://changed");
  });

  // Le mode Allégé est un MP4 fragmenté : la plateforme le finalise (remux
  // indexé) avant « complete » ; un original n'est jamais touché.
  it("un fichier Allege est finalise par la plateforme avant complete, jamais un original", async () => {
    const db = openInMemory();
    const root = rootWithThreeItems();
    const light = claimOrCreateFile(db, spec({
      itemId: "item1", variant: "light", preset: "p480", relPath: "media/item1/light-ms1-p480.mp4", expectedSize: null,
    })).fileId;
    const original = seed(db, "item2", 2_000);
    const finalized: string[] = [];
    const { engine } = makeEngine(db, root, immediateNet(200), {
      finalizeMedia: async (absPath) => { finalized.push(absPath); },
    });

    engine.start(CREDS);
    // Les deux se suivent, et le remux s'intercale : on attend le second.
    await vi.waitFor(() => {
      expect(getFile(db, original)?.status).toBe("complete");
    });

    expect(finalized).toEqual([path.join(root, "media", "item1", "light-ms1-p480.mp4")]);
    expect(getFile(db, light)?.status).toBe("complete");
  });

  // Le media est deja renomme en fichier final quand le remux part : un remux
  // rate laisse donc un fichier COMPLET sur le disque. Le perdre couterait des
  // centaines de megaoctets a retelecharger.
  it("une finalisation qui echoue garde le media recu et retient la phase", async () => {
    const db = openInMemory();
    const root = rootWithThreeItems();
    const light = claimOrCreateFile(db, spec({
      itemId: "item1", variant: "light", preset: "p480", relPath: "media/item1/light-ms1-p480.mp4", expectedSize: null,
    })).fileId;
    const { engine } = makeEngine(db, root, immediateNet(200), {
      finalizeMedia: async () => { throw new Error("remux impossible"); },
    });

    engine.start(CREDS);
    await new Promise((resolve) => setTimeout(resolve, 30));

    const file = getFile(db, light);
    expect(file?.status).toBe("error");
    expect(file?.errorCode).toBe("finalize");
    expect(file?.phase).toBe("finalize");
    // La taille REELLE du fichier recu, pas la valeur lue en debut de travail.
    expect(file?.bytesDone).toBe(3);
  });

  // Un media arrive SANS son index : aucun remux ne le reparera. Le garder
  // reviendrait a occuper des centaines de megaoctets pour un titre qui ne se
  // lira jamais, et a rejouer trois fois un remux impossible.
  it("un media sans index est jete, et le transfert repart de zero", async () => {
    const db = openInMemory();
    const root = rootWithThreeItems();
    const relPath = "media/item1/light-ms1-p480.mp4";
    const light = claimOrCreateFile(db, spec({
      itemId: "item1", variant: "light", preset: "p480", relPath, expectedSize: null,
    })).fileId;
    const { engine } = makeEngine(db, root, immediateNet(200), {
      finalizeMedia: async () => "unusable" as const,
    });

    engine.start(CREDS);
    await vi.waitFor(() => {
      expect(getFile(db, light)?.status).toBe("error");
    });

    const file = getFile(db, light);
    expect(file?.errorCode).toBe("integrity");
    // La phase tombe : la reprise repart du telechargement, pas du remux.
    expect(file?.phase).toBeNull();
    expect(file?.bytesDone).toBe(0);
    expect(fs.existsSync(path.join(root, relPath))).toBe(false);
  });

  it("reprendre une finalisation ratee ne retelecharge rien", async () => {
    const db = openInMemory();
    const root = rootWithThreeItems();
    const light = claimOrCreateFile(db, spec({
      itemId: "item1", variant: "light", preset: "p480", relPath: "media/item1/light-ms1-p480.mp4", expectedSize: null,
    })).fileId;
    let opened = 0;
    let remuxRate = true;
    const net: TransferNet = {
      async open() {
        opened += 1;
        return {
          status: 200,
          header: () => null,
          chunks: (async function* () { yield new Uint8Array([1, 2, 3]); })(),
        };
      },
      async killTranscode() { /* rien */ },
    };
    const { engine } = makeEngine(db, root, net, {
      finalizeMedia: async () => {
        if (remuxRate) throw new Error("remux impossible");
      },
    });

    engine.start(CREDS);
    await vi.waitFor(() => {
      expect(getFile(db, light)?.status).toBe("error");
    });
    expect(opened).toBe(1);

    remuxRate = false;
    engine.resume(light);
    await vi.waitFor(() => {
      expect(getFile(db, light)?.status).toBe("complete");
    });

    // Aucun second flux : seule la finalisation a rejoue.
    expect(opened).toBe(1);
    expect(getFile(db, light)?.phase).toBeNull();
  });

  it("une finalisation interrompue par un arret de l'application se termine au redemarrage", async () => {
    const db = openInMemory();
    const root = rootWithThreeItems();
    const light = claimOrCreateFile(db, spec({
      itemId: "item1", variant: "light", preset: "p480", relPath: "media/item1/light-ms1-p480.mp4", expectedSize: null,
    })).fileId;
    // L'etat laisse par un processus tue en plein remux : le media est la, le
    // statut est reste `downloading`, la phase dit ce qu'il restait a faire.
    writeMedia(root, "media/item1/light-ms1-p480.mp4", "media complete");
    db.prepare("UPDATE files SET status = 'downloading', phase = 'finalize' WHERE id = ?").run(light);
    let opened = 0;
    const net: TransferNet = {
      async open() {
        opened += 1;
        throw new Error("le reseau ne doit pas etre sollicite");
      },
      async killTranscode() { /* rien */ },
    };
    const { engine } = makeEngine(db, root, net, { finalizeMedia: async () => { /* remux reussi */ } });

    engine.start(CREDS);
    await vi.waitFor(() => {
      expect(getFile(db, light)?.status).toBe("complete");
    });

    expect(opened).toBe(0);
    expect(getFile(db, light)?.bytesDone).toBe("media complete".length);
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
