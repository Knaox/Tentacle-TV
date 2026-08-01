/**
 * La mise en file.
 *
 * Deux choses s'y jouent qu'on ne voit qu'en cas de problème : le refus GLOBAL
 * quand la place manque — accepter la moitié d'une saison remplirait le disque
 * au milieu —, et la validation des identifiants, qui finissent dans un nom de
 * fichier.
 */

import type { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { openInMemory } from "./db";
import { enqueueBatch, mediaRelPath, neededBytesFor, type EnqueueItem } from "./enqueue";
import { listForUser } from "./listing";
import { CAPACITY_MARGIN_BYTES } from "./paths";
import { compter, marquerVu } from "./testkit";

const GIO = 1024 * 1024 * 1024;

function item(partial: Partial<EnqueueItem> = {}): EnqueueItem {
  return {
    itemId: "item1",
    mediaSourceId: "ms1",
    variant: "original",
    preset: null,
    containerExt: "mkv",
    expectedSize: GIO,
    estimatedSize: null,
    kind: "movie",
    seriesId: null,
    seasonId: null,
    libraryId: null,
    runtimeTicks: null,
    title: "Un film",
    seriesName: null,
    indexNumber: null,
    parentIndexNumber: null,
    autoDeleteAfterWatch: false,
    autoDeleteDelayMinutes: 0,
    audioStreamIndex: null,
    burnSubtitleIndex: null,
    subtitles: null,
    ...partial,
  };
}

function mettreEnFile(
  db: DatabaseSync,
  items: EnqueueItem[],
  libre = 100 * GIO,
): ReturnType<typeof enqueueBatch> {
  return enqueueBatch(db, "u", items, libre, 1_000);
}

describe("validation", () => {
  it("un lot vide est refuse", () => {
    expect(() => mettreEnFile(openInMemory(), [])).toThrow("empty-batch");
  });

  it("refuse ce qui ne peut pas entrer dans un nom de fichier", () => {
    const mauvais: Array<Partial<EnqueueItem>> = [
      { itemId: "" },
      { itemId: "../evil" },
      { itemId: "a".repeat(65) },
      { mediaSourceId: "ms/1" },
      { containerExt: "" },
      { containerExt: "MKV" },
      { containerExt: "trop-long" },
      { preset: "P720" },
      { variant: "bogus" },
      { kind: "serie" },
    ];
    for (const partial of mauvais) {
      expect(() => mettreEnFile(openInMemory(), [item(partial)]), JSON.stringify(partial)).toThrow(
        "invalid-item",
      );
    }
  });

  it("un lot invalide n'enqueue RIEN, meme partiellement", () => {
    const db = openInMemory();
    expect(() => mettreEnFile(db, [item(), item({ itemId: "../evil" })])).toThrow("invalid-item");
    expect(compter(db, "files")).toBe(0);
  });
});

describe("chemins figes", () => {
  it("l'Original porte son conteneur, l'Allege son preset", () => {
    expect(mediaRelPath(item())).toBe("media/item1/original-ms1.mkv");
    expect(mediaRelPath(item({ variant: "light", preset: "p1080" }))).toBe(
      "media/item1/light-ms1-p1080.mp4",
    );
    // Preset absent : le defaut du Rust, pour rester compatible avec l'existant.
    expect(mediaRelPath(item({ variant: "light", preset: null }))).toBe(
      "media/item1/light-ms1-p720.mp4",
    );
  });
});

describe("controle d'espace", () => {
  it("refuse le lot ENTIER quand la place manque", () => {
    const db = openInMemory();
    const saison = [1, 2, 3].map((n) => item({ itemId: `ep${n}`, expectedSize: 2 * GIO }));

    // 6 Gio demandes + 2 de marge : 7 ne suffisent pas.
    const outcome = mettreEnFile(db, saison, 7 * GIO);

    expect(outcome.accepted).toBe(false);
    expect(outcome.neededBytes).toBe(6 * GIO);
    expect(outcome.fileIds).toEqual([]);
    expect(compter(db, "files")).toBe(0);
  });

  it("accepte quand la marge est respectee", () => {
    const db = openInMemory();
    const outcome = mettreEnFile(db, [item({ expectedSize: GIO })], 3 * GIO + 1);

    expect(outcome.accepted).toBe(true);
    expect(outcome.fileIds).toHaveLength(1);
  });

  it("les transferts deja promis entrent dans le calcul", () => {
    const db = openInMemory();
    mettreEnFile(db, [item({ expectedSize: 5 * GIO })]);

    // Le second lot doit compter le premier, encore en file.
    expect(neededBytesFor(db, [item({ itemId: "item2", expectedSize: 3 * GIO })])).toBe(8 * GIO);
  });

  it("un fichier deja present ne compte pas deux fois", () => {
    const db = openInMemory();
    mettreEnFile(db, [item()]);
    db.exec("UPDATE files SET status = 'complete', bytes_done = 1073741824");

    // On va s'accrocher a l'existant, pas le retelecharger.
    expect(neededBytesFor(db, [item()])).toBe(0);
  });

  it("l'estimation prime sur la taille annoncee pour l'Allege", () => {
    const db = openInMemory();
    const allege = item({ variant: "light", preset: "p720", expectedSize: null, estimatedSize: 2 * GIO });
    expect(neededBytesFor(db, [allege])).toBe(2 * GIO);
  });

  it("la marge est bien celle du Rust", () => {
    expect(CAPACITY_MARGIN_BYTES).toBe(2 * GIO);
  });
});

describe("effets de la mise en file", () => {
  it("pose la meta, le claim et les parametres de l'Allege", () => {
    const db = openInMemory();
    const outcome = mettreEnFile(db, [
      item({
        variant: "light",
        preset: "p720",
        kind: "episode",
        seriesId: "serie1",
        seasonId: "saison1",
        seriesName: "Une serie",
        indexNumber: 4,
        parentIndexNumber: 2,
        audioStreamIndex: 3,
        burnSubtitleIndex: 5,
        subtitles: [{ index: 7, format: "srt", langTag: "fre" }],
      }),
    ]);

    const entree = listForUser(db, "u")[0];
    expect(outcome.accepted).toBe(true);
    expect(entree?.seriesName).toBe("Une serie");
    expect(entree?.indexNumber).toBe(4);
    expect(entree?.audioStreamIndex).toBe(3);
    const brut = db.prepare("SELECT subtitles_json AS s FROM files").get();
    expect(String(brut?.["s"])).toContain('"index":7');
  });

  it("re-mettre en file applique l'intention du dialogue", () => {
    const db = openInMemory();
    mettreEnFile(db, [item()]);
    marquerVu(db, "u", "item1");

    // Meme item, mais on coche cette fois « supprimer apres visionnage ».
    mettreEnFile(db, [item({ autoDeleteAfterWatch: true, autoDeleteDelayMinutes: 45 })]);

    const entree = listForUser(db, "u")[0];
    expect(entree?.autoDeleteAfterWatch).toBe(true);
    expect(entree?.autoDeleteDelayMinutes).toBe(45);
  });

  it("deux comptes sur le meme media ne creent qu'un fichier", () => {
    const db = openInMemory();
    enqueueBatch(db, "userA", [item()], 100 * GIO, 1_000);
    enqueueBatch(db, "userB", [item()], 100 * GIO, 2_000);

    expect(compter(db, "files")).toBe(1);
    expect(compter(db, "claims")).toBe(2);
  });
});
