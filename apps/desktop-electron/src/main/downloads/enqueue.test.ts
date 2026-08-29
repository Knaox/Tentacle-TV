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
import { countRows, markWatched } from "./testkit";

const GIB = 1024 * 1024 * 1024;

function item(partial: Partial<EnqueueItem> = {}): EnqueueItem {
  return {
    itemId: "item1",
    mediaSourceId: "ms1",
    variant: "original",
    preset: null,
    containerExt: "mkv",
    expectedSize: GIB,
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

function enqueue(
  db: DatabaseSync,
  items: EnqueueItem[],
  free = 100 * GIB,
): ReturnType<typeof enqueueBatch> {
  return enqueueBatch(db, "u", items, free, 1_000);
}

describe("validation", () => {
  it("un lot vide est refuse", () => {
    expect(() => enqueue(openInMemory(), [])).toThrow("empty-batch");
  });

  it("refuse ce qui ne peut pas entrer dans un nom de fichier", () => {
    const bad: Array<Partial<EnqueueItem>> = [
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
    for (const partial of bad) {
      expect(() => enqueue(openInMemory(), [item(partial)]), JSON.stringify(partial)).toThrow(
        "invalid-item",
      );
    }
  });

  it("un lot invalide n'enqueue RIEN, meme partiellement", () => {
    const db = openInMemory();
    expect(() => enqueue(db, [item(), item({ itemId: "../evil" })])).toThrow("invalid-item");
    expect(countRows(db, "files")).toBe(0);
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
    const season = [1, 2, 3].map((n) => item({ itemId: `ep${n}`, expectedSize: 2 * GIB }));

    // 6 Gio demandes + 2 de marge : 7 ne suffisent pas.
    const outcome = enqueue(db, season, 7 * GIB);

    expect(outcome.accepted).toBe(false);
    expect(outcome.neededBytes).toBe(6 * GIB);
    expect(outcome.fileIds).toEqual([]);
    expect(countRows(db, "files")).toBe(0);
  });

  it("accepte quand la marge est respectee", () => {
    const db = openInMemory();
    const outcome = enqueue(db, [item({ expectedSize: GIB })], 3 * GIB + 1);

    expect(outcome.accepted).toBe(true);
    expect(outcome.fileIds).toHaveLength(1);
  });

  it("les transferts deja promis entrent dans le calcul", () => {
    const db = openInMemory();
    enqueue(db, [item({ expectedSize: 5 * GIB })]);

    // Le second lot doit compter le premier, encore en file.
    expect(neededBytesFor(db, [item({ itemId: "item2", expectedSize: 3 * GIB })])).toBe(8 * GIB);
  });

  it("un fichier deja present ne compte pas deux fois", () => {
    const db = openInMemory();
    enqueue(db, [item()]);
    db.exec("UPDATE files SET status = 'complete', bytes_done = 1073741824");

    // On va s'accrocher a l'existant, pas le retelecharger.
    expect(neededBytesFor(db, [item()])).toBe(0);
  });

  it("l'estimation prime sur la taille annoncee pour l'Allege", () => {
    const db = openInMemory();
    const light = item({ variant: "light", preset: "p720", expectedSize: null, estimatedSize: 2 * GIB });
    expect(neededBytesFor(db, [light])).toBe(2 * GIB);
  });

  it("la marge est bien celle du Rust", () => {
    expect(CAPACITY_MARGIN_BYTES).toBe(2 * GIB);
  });
});

describe("effets de la mise en file", () => {
  it("pose la meta, le claim et les parametres de l'Allege", () => {
    const db = openInMemory();
    const outcome = enqueue(db, [
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

    const entry = listForUser(db, "u")[0];
    expect(outcome.accepted).toBe(true);
    expect(entry?.seriesName).toBe("Une serie");
    expect(entry?.indexNumber).toBe(4);
    expect(entry?.audioStreamIndex).toBe(3);
    const raw = db.prepare("SELECT subtitles_json AS s FROM files").get();
    expect(String(raw?.["s"])).toContain('"index":7');
  });

  it("re-mettre en file applique l'intention du dialogue", () => {
    const db = openInMemory();
    enqueue(db, [item()]);
    markWatched(db, "u", "item1");

    // Meme item, mais on coche cette fois « supprimer apres visionnage ».
    enqueue(db, [item({ autoDeleteAfterWatch: true, autoDeleteDelayMinutes: 45 })]);

    const entry = listForUser(db, "u")[0];
    expect(entry?.autoDeleteAfterWatch).toBe(true);
    expect(entry?.autoDeleteDelayMinutes).toBe(45);
  });

  it("deux comptes sur le meme media ne creent qu'un fichier", () => {
    const db = openInMemory();
    enqueueBatch(db, "userA", [item()], 100 * GIB, 1_000);
    enqueueBatch(db, "userB", [item()], 100 * GIB, 2_000);

    expect(countRows(db, "files")).toBe(1);
    expect(countRows(db, "claims")).toBe(2);
  });
});
