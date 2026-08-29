/**
 * Transposition de `store_tests.rs` : la déduplication par claims et la
 * résolution de source. Ce sont les invariants qui décident si un utilisateur
 * retrouve ses films — et si un compte peut voir ceux d'un autre.
 */

import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { openInMemory } from "./db";
import { getFile } from "./queue";
import {
  claimOrCreateFile,
  completeFileForItem,
  deleteClaim,
  findFile,
  publicFile,
} from "./store";
import { countRows, writeMedia, preparedRoot, spec } from "./testkit";

describe("deduplication par claims", () => {
  it("deux comptes, un seul fichier", () => {
    const db = openInMemory();

    const a = claimOrCreateFile(db, spec({ userId: "userA" }));
    const b = claimOrCreateFile(db, spec({ userId: "userB", nowMs: 2_000 }));

    expect(a.created).toBe(true);
    expect(b.created).toBe(false);
    expect(a.fileId).toBe(b.fileId);
    expect(countRows(db, "files")).toBe(1);
    expect(countRows(db, "claims")).toBe(2);
  });

  it("le fichier physique ne part qu'au DERNIER claim", () => {
    const root = preparedRoot("tentacle-store-");
    const rel = "media/item1/original-ms1.mkv";
    writeMedia(root, rel);
    const db = openInMemory();
    const o = claimOrCreateFile(db, spec({ userId: "userA" }));
    claimOrCreateFile(db, spec({ userId: "userB" }));

    // userA supprime : userB reference encore le fichier.
    const d1 = deleteClaim(db, root, "userA", o.fileId);
    expect(d1.fileDeleted).toBe(false);
    expect(existsSync(path.join(root, rel))).toBe(true);

    // Dernier claim : suppression physique, et meta orpheline purgee avec.
    const d2 = deleteClaim(db, root, "userB", o.fileId);
    expect(d2.fileDeleted).toBe(true);
    expect(d2.metaDeleted).toBe(true);
    expect(existsSync(path.join(root, rel))).toBe(false);
  });

  it("le dossier media entier part, side-cars compris", () => {
    const root = preparedRoot("tentacle-store-");
    writeMedia(root, "media/item1/original-ms1.mkv");
    writeMedia(root, "media/item1/subs/3-fre.srt");
    const db = openInMemory();
    const o = claimOrCreateFile(db, spec());

    deleteClaim(db, root, "u", o.fileId);

    // Sans cette suppression recursive, les sous-titres restaient orphelins.
    expect(existsSync(path.join(root, "media", "item1"))).toBe(false);
  });

  it("supprimer un claim inexistant ne casse rien", () => {
    const root = preparedRoot("tentacle-store-");
    const db = openInMemory();

    expect(deleteClaim(db, root, "inconnu", 999)).toEqual({
      fileDeleted: false,
      metaDeleted: false,
    });
  });

  it("un fichier annule est reactive, pas duplique", () => {
    const db = openInMemory();
    const o = claimOrCreateFile(db, spec());
    db.exec("UPDATE files SET status = 'canceled', bytes_done = 42");

    const still = claimOrCreateFile(db, spec({ nowMs: 2_000 }));

    expect(still.fileId).toBe(o.fileId);
    const file = getFile(db, o.fileId);
    expect(file?.status).toBe("queued");
    expect(file?.bytesDone).toBe(0);
  });

  it("l'identite distingue les variantes et les presets", () => {
    const db = openInMemory();
    claimOrCreateFile(db, spec());
    claimOrCreateFile(
      db,
      spec({ variant: "light", preset: "p720", relPath: "media/item1/light-ms1-p720.mp4" }),
    );

    expect(countRows(db, "files")).toBe(2);
    expect(findFile(db, { itemId: "item1", mediaSourceId: "ms1", variant: "original", preset: null })).not
      .toBeNull();
    expect(
      findFile(db, { itemId: "item1", mediaSourceId: "ms1", variant: "light", preset: "p1080" }),
    ).toBeNull();
  });
});

describe("resolution de source", () => {
  it("prefere l'Original complet a l'Allege", () => {
    const db = openInMemory();
    const light = claimOrCreateFile(
      db,
      spec({ variant: "light", preset: "p720", relPath: "media/item1/light-ms1-p720.mp4" }),
    );
    const original = claimOrCreateFile(db, spec());
    db.exec("UPDATE files SET status = 'complete'");

    const best = completeFileForItem(db, "u", "item1");

    expect(best?.id).toBe(original.fileId);
    expect(best?.id).not.toBe(light.fileId);
    // Un autre compte ne voit rien.
    expect(completeFileForItem(db, "autre", "item1")).toBeNull();
  });

  it("un fichier incomplet n'est JAMAIS presente comme lisible", () => {
    const db = openInMemory();
    claimOrCreateFile(db, spec());

    expect(completeFileForItem(db, "u", "item1")).toBeNull();
  });
});

describe("forme publique", () => {
  it("retire le champ interne et garde les autres", () => {
    const db = openInMemory();
    const o = claimOrCreateFile(db, spec());
    const file = getFile(db, o.fileId);
    expect(file).not.toBeNull();
    if (file === null) return;

    const publicRow = publicFile(file);

    // `subtitlesJson` etait `#[serde(skip_serializing)]` cote Rust : il ne doit
    // jamais traverser l'IPC.
    expect(publicRow).not.toHaveProperty("subtitlesJson");
    expect(publicRow.relPath).toBe("media/item1/original-ms1.mkv");
    expect(publicRow.status).toBe("queued");
  });
});
