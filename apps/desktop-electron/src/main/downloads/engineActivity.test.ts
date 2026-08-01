/**
 * Ce que le moteur dit de son activité, et ce qu'il reprend tout seul.
 *
 * Trois choses invisibles tant qu'elles marchent, et coûteuses quand elles
 * lâchent : une bascule d'activité qui se répète poserait un blocage
 * d'anti-suspension des milliers de fois par film ; une bascule manquante à la
 * fin laisserait le PC éveillé toute la nuit ; un compte faux ferait poser une
 * question de sortie pour rien, ou laisserait partir un transfert sans un mot.
 */

import { describe, expect, it } from "vitest";
import { openInMemory } from "./db";
import { getFile } from "./queue";
import {
  CREDS,
  moteur,
  poserPause,
  racineTroisItems,
  reseauImmediat,
  reseauRetenu,
  semer,
} from "./testkit";

describe("bascule occupe / inoccupe", () => {
  it("ne signale qu'aux transitions, une fois a l'entree et une a la sortie", async () => {
    const db = openInMemory();
    const root = racineTroisItems();
    semer(db, "item1", 1_000);
    semer(db, "item2", 2_000);
    const { engine, bascules } = moteur(db, root, reseauImmediat(200));

    engine.start(CREDS);
    await new Promise((resolve) => setTimeout(resolve, 30));

    // Deux transferts, deux fins : et pourtant une seule montee, une seule
    // descente.
    expect(bascules).toEqual([true, false]);
  });

  it("ne signale rien quand il n'y a rien a telecharger", () => {
    const db = openInMemory();
    const root = racineTroisItems();
    const { engine, bascules } = moteur(db, root, reseauImmediat(200));

    engine.start(CREDS);

    expect(bascules).toEqual([]);
  });
});

describe("reprise des pauses systeme", () => {
  it("relance une pause systeme et laisse la pause explicite", () => {
    const db = openInMemory();
    const root = racineTroisItems();
    const systeme = semer(db, "item1", 1_000);
    const explicite = semer(db, "item2", 2_000);
    poserPause(db, systeme, false);
    poserPause(db, explicite, true);
    const retenu = reseauRetenu();
    const { engine } = moteur(db, root, retenu.net);
    // `setCreds` plutot que `start` : `start` normalise la file et rattraperait
    // la pause systeme de lui-meme, ce qui ne prouverait rien.
    engine.setCreds(CREDS);

    engine.resumeSystemPauses();

    expect(getFile(db, systeme)?.status).toBe("downloading");
    expect(getFile(db, explicite)?.status).toBe("paused");
    retenu.liberer();
  });

  it("sans identifiants, ne touche a rien", () => {
    const db = openInMemory();
    const root = racineTroisItems();
    const fileId = semer(db, "item1", 1_000);
    poserPause(db, fileId, false);
    const { engine } = moteur(db, root, reseauImmediat(200));

    engine.resumeSystemPauses();

    expect(getFile(db, fileId)?.status).toBe("paused");
  });
});

describe("transferts en cours", () => {
  it("compte les actifs ET la file", async () => {
    const db = openInMemory();
    const root = racineTroisItems();
    semer(db, "item1", 1_000);
    semer(db, "item2", 2_000);
    semer(db, "item3", 3_000);
    const retenu = reseauRetenu();
    const { engine } = moteur(db, root, retenu.net);

    engine.start(CREDS);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(engine.pending()).toBe(3);
    retenu.liberer();
  });

  it("ne compte rien sans identifiants", () => {
    const db = openInMemory();
    const root = racineTroisItems();
    semer(db, "item1", 1_000);
    const { engine } = moteur(db, root, reseauImmediat(200));

    expect(engine.pending()).toBe(0);
  });
});
