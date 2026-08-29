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
  makeEngine,
  applyPause,
  rootWithThreeItems,
  immediateNet,
  heldNet,
  seed,
} from "./testkit";

describe("bascule occupe / inoccupe", () => {
  it("ne signale qu'aux transitions, une fois a l'entree et une a la sortie", async () => {
    const db = openInMemory();
    const root = rootWithThreeItems();
    seed(db, "item1", 1_000);
    seed(db, "item2", 2_000);
    const { engine, toggles } = makeEngine(db, root, immediateNet(200));

    engine.start(CREDS);
    await new Promise((resolve) => setTimeout(resolve, 30));

    // Deux transferts, deux fins : et pourtant une seule montee, une seule
    // descente.
    expect(toggles).toEqual([true, false]);
  });

  it("ne signale rien quand il n'y a rien a telecharger", () => {
    const db = openInMemory();
    const root = rootWithThreeItems();
    const { engine, toggles } = makeEngine(db, root, immediateNet(200));

    engine.start(CREDS);

    expect(toggles).toEqual([]);
  });
});

describe("reprise des pauses systeme", () => {
  it("relance une pause systeme et laisse la pause explicite", () => {
    const db = openInMemory();
    const root = rootWithThreeItems();
    const system = seed(db, "item1", 1_000);
    const explicit = seed(db, "item2", 2_000);
    applyPause(db, system, false);
    applyPause(db, explicit, true);
    const held = heldNet();
    const { engine } = makeEngine(db, root, held.net);
    // `setCreds` plutot que `start` : `start` normalise la file et rattraperait
    // la pause systeme de lui-meme, ce qui ne prouverait rien.
    engine.setCreds(CREDS);

    engine.resumeSystemPauses();

    expect(getFile(db, system)?.status).toBe("downloading");
    expect(getFile(db, explicit)?.status).toBe("paused");
    held.release();
  });

  it("sans identifiants, ne touche a rien", () => {
    const db = openInMemory();
    const root = rootWithThreeItems();
    const fileId = seed(db, "item1", 1_000);
    applyPause(db, fileId, false);
    const { engine } = makeEngine(db, root, immediateNet(200));

    engine.resumeSystemPauses();

    expect(getFile(db, fileId)?.status).toBe("paused");
  });
});

describe("transferts en cours", () => {
  it("compte les actifs ET la file", async () => {
    const db = openInMemory();
    const root = rootWithThreeItems();
    seed(db, "item1", 1_000);
    seed(db, "item2", 2_000);
    seed(db, "item3", 3_000);
    const held = heldNet();
    const { engine } = makeEngine(db, root, held.net);

    engine.start(CREDS);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(engine.pending()).toBe(3);
    held.release();
  });

  it("ne compte rien sans identifiants", () => {
    const db = openInMemory();
    const root = rootWithThreeItems();
    seed(db, "item1", 1_000);
    const { engine } = makeEngine(db, root, immediateNet(200));

    expect(engine.pending()).toBe(0);
  });
});
