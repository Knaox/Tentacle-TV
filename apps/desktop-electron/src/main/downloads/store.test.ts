/**
 * Transposition de `store_tests.rs` et des `#[test]` de `queue.rs`.
 *
 * Ce sont les invariants qui décident si un utilisateur retrouve ses films :
 * la déduplication entre comptes, la suppression au DERNIER claim seulement, le
 * cloisonnement des listes, et la pause utilisateur qui survit au redémarrage.
 */

import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { openInMemory } from "./db";
import { listForUser, setAutoDelete, stateForItem } from "./listing";
import { ensureLayout } from "./paths";
import {
  claimOrCreateFile,
  completeFileForItem,
  deleteClaim,
  diskUsage,
  publicFile,
  type ClaimSpec,
} from "./store";
import {
  getFile,
  nextQueued,
  normalizeOnEngineStart,
  pendingBytes,
  setBytesDone,
  setPausedByUser,
  setStatus,
} from "./queue";
import { integer, text } from "./rows";

const dossiers: string[] = [];

function racinePreparee(): string {
  const root = mkdtempSync(path.join(tmpdir(), "tentacle-store-"));
  dossiers.push(root);
  ensureLayout(root);
  return root;
}

function ecrireMedia(root: string, rel: string): void {
  const cible = path.join(root, rel);
  mkdirSync(path.dirname(cible), { recursive: true });
  writeFileSync(cible, "data");
}

afterEach(() => {
  while (dossiers.length > 0) {
    const dir = dossiers.pop();
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  }
});

function spec(partial: Partial<ClaimSpec> = {}): ClaimSpec {
  return {
    userId: "u",
    itemId: "item1",
    mediaSourceId: "ms1",
    variant: "original",
    preset: null,
    relPath: "media/item1/original-ms1.mkv",
    expectedSize: 4,
    autoDeleteAfterWatch: false,
    nowMs: 1_000,
    ...partial,
  };
}

function compter(db: DatabaseSync, table: string): number {
  const row = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get();
  return row === undefined ? 0 : integer(row, "n");
}

describe("deduplication par claims", () => {
  it("deux comptes, un seul fichier", () => {
    const db = openInMemory();

    const a = claimOrCreateFile(db, spec({ userId: "userA" }));
    const b = claimOrCreateFile(db, spec({ userId: "userB", nowMs: 2_000 }));

    expect(a.created).toBe(true);
    expect(b.created).toBe(false);
    expect(a.fileId).toBe(b.fileId);
    expect(compter(db, "files")).toBe(1);
    expect(compter(db, "claims")).toBe(2);
  });

  it("le fichier physique ne part qu'au DERNIER claim", () => {
    const root = racinePreparee();
    const rel = "media/item1/original-ms1.mkv";
    ecrireMedia(root, rel);
    const db = openInMemory();
    const o = claimOrCreateFile(db, spec({ userId: "userA" }));
    claimOrCreateFile(db, spec({ userId: "userB" }));

    // userA supprime : userB reference encore.
    const d1 = deleteClaim(db, root, "userA", o.fileId);
    expect(d1.fileDeleted).toBe(false);
    expect(existsSync(path.join(root, rel))).toBe(true);

    // Dernier claim : suppression physique et meta orpheline purgee.
    const d2 = deleteClaim(db, root, "userB", o.fileId);
    expect(d2.fileDeleted).toBe(true);
    expect(d2.metaDeleted).toBe(true);
    expect(existsSync(path.join(root, rel))).toBe(false);
  });

  it("supprimer un claim inexistant ne casse rien", () => {
    const root = racinePreparee();
    const db = openInMemory();
    expect(deleteClaim(db, root, "inconnu", 999)).toEqual({ fileDeleted: false, metaDeleted: false });
  });

  it("un fichier annule est reactive, pas duplique", () => {
    const db = openInMemory();
    const o = claimOrCreateFile(db, spec());
    db.exec("UPDATE files SET status = 'canceled', bytes_done = 42");

    const encore = claimOrCreateFile(db, spec({ nowMs: 2_000 }));

    expect(encore.fileId).toBe(o.fileId);
    const file = getFile(db, o.fileId);
    expect(file?.status).toBe("queued");
    expect(file?.bytesDone).toBe(0);
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

  it("un fichier incomplet n'est jamais presente comme lisible", () => {
    const db = openInMemory();
    claimOrCreateFile(db, spec());
    expect(completeFileForItem(db, "u", "item1")).toBeNull();
  });
});

describe("listes", () => {
  it("sont cloisonnees par utilisateur", () => {
    const db = openInMemory();
    claimOrCreateFile(db, spec({ userId: "userA" }));
    claimOrCreateFile(
      db,
      spec({
        userId: "userB",
        itemId: "item2",
        mediaSourceId: "ms2",
        variant: "light",
        preset: "p720",
        relPath: "media/item2/light-ms2-p720.mp4",
      }),
    );

    expect(listForUser(db, "userA").map((e) => e.itemId)).toEqual(["item1"]);
    expect(listForUser(db, "userB").map((e) => e.itemId)).toEqual(["item2"]);
    expect(listForUser(db, "userC")).toEqual([]);
  });

  it("ne transmettent JAMAIS la liste interne des side-cars", () => {
    const db = openInMemory();
    const o = claimOrCreateFile(db, spec());
    db.prepare("UPDATE files SET subtitles_json = ? WHERE id = ?").run("[{\"index\":3}]", o.fileId);

    const entree = listForUser(db, "u")[0];

    expect(entree).toBeDefined();
    expect(Object.keys(entree ?? {})).not.toContain("subtitlesJson");
  });

  it("l'etat par item prefere le complet", () => {
    const db = openInMemory();
    claimOrCreateFile(
      db,
      spec({ variant: "light", preset: "p720", relPath: "media/item1/light-ms1-p720.mp4" }),
    );
    const original = claimOrCreateFile(db, spec());
    db.prepare("UPDATE files SET status = 'complete' WHERE id = ?").run(original.fileId);

    expect(stateForItem(db, "u", "item1")?.id).toBe(original.fileId);
    expect(stateForItem(db, "u", "inconnu")).toBeNull();
  });
});

describe("file d'attente", () => {
  function semer(db: DatabaseSync, itemId: string, at: number): number {
    return claimOrCreateFile(
      db,
      spec({ itemId, relPath: `media/${itemId}/original-ms1.mkv`, expectedSize: 100, nowMs: at }),
    ).fileId;
  }

  it("FIFO, et sortie de file au lancement", () => {
    const db = openInMemory();
    const premier = semer(db, "item1", 1_000);
    const second = semer(db, "item2", 2_000);

    expect(nextQueued(db)?.id).toBe(premier);
    setStatus(db, premier, "downloading", null, 3_000);
    expect(nextQueued(db)?.id).toBe(second);
  });

  it("la normalisation au demarrage respecte la pause UTILISATEUR", () => {
    const db = openInMemory();
    const interrompu = semer(db, "item1", 1_000);
    const pauseSysteme = semer(db, "item2", 2_000);
    const pauseUtilisateur = semer(db, "item3", 3_000);
    setStatus(db, interrompu, "downloading", null, 4_000);
    setStatus(db, pauseSysteme, "paused", null, 4_000);
    setStatus(db, pauseUtilisateur, "paused", null, 4_000);
    setPausedByUser(db, pauseUtilisateur, true);

    normalizeOnEngineStart(db, 5_000);

    expect(getFile(db, interrompu)?.status).toBe("queued");
    expect(getFile(db, pauseSysteme)?.status).toBe("queued");
    expect(getFile(db, pauseUtilisateur)?.status).toBe("paused");
  });

  it("les octets en attente soustraient le deja recu", () => {
    const db = openInMemory();
    const a = semer(db, "item1", 1_000);
    semer(db, "item2", 2_000);
    setBytesDone(db, a, 40, 3_000);

    expect(pendingBytes(db)).toBe(160); // (100-40) + (100-0)
    expect(diskUsage(db)).toBe(40);
  });
});

describe("auto-suppression", () => {
  it("desactiver remet tout a zero", () => {
    const db = openInMemory();
    const o = claimOrCreateFile(db, spec({ autoDeleteAfterWatch: true }));
    setAutoDelete(db, "u", o.fileId, true, 60, 1_000_000);

    setAutoDelete(db, "u", o.fileId, false, 0, 2_000_000);

    const entree = listForUser(db, "u")[0];
    expect(entree?.autoDeleteAfterWatch).toBe(false);
    expect(entree?.autoDeleteDelayMinutes).toBe(0);
    expect(entree?.deleteScheduledAt).toBeNull();
  });

  it("activer sur un item NON VU ne planifie rien", () => {
    const db = openInMemory();
    const o = claimOrCreateFile(db, spec());

    setAutoDelete(db, "u", o.fileId, true, 30, 1_000_000);

    expect(listForUser(db, "u")[0]?.deleteScheduledAt).toBeNull();
  });

  it("activer sur un item DEJA VU planifie depuis maintenant", () => {
    const db = openInMemory();
    const o = claimOrCreateFile(db, spec());
    db.prepare(
      `INSERT INTO playback_state (jellyfin_user_id, item_id, position_ticks, played, updated_at)
       VALUES ('u', 'item1', 0, 1, 1)`,
    ).run();

    setAutoDelete(db, "u", o.fileId, true, 30, 1_000_000);

    // Jamais de suppression surprise : l'echeance part de maintenant + delai.
    expect(listForUser(db, "u")[0]?.deleteScheduledAt).toBe(1_000 + 30 * 60);
  });

  it("changer le delai REBASE sur le moment du visionnage", () => {
    const db = openInMemory();
    const o = claimOrCreateFile(db, spec());
    db.prepare(
      `INSERT INTO playback_state (jellyfin_user_id, item_id, position_ticks, played, updated_at)
       VALUES ('u', 'item1', 0, 1, 1)`,
    ).run();
    setAutoDelete(db, "u", o.fileId, true, 30, 1_000_000); // vu a t=1000 s

    // Bien plus tard, on passe le delai a 60 min : l'echeance reste ancree au
    // visionnage, elle ne repart pas de maintenant.
    setAutoDelete(db, "u", o.fileId, true, 60, 9_000_000);

    expect(listForUser(db, "u")[0]?.deleteScheduledAt).toBe(1_000 + 60 * 60);
  });
});

describe("forme publique", () => {
  it("retire le champ interne et garde les autres", () => {
    const db = openInMemory();
    const o = claimOrCreateFile(db, spec());
    const file = getFile(db, o.fileId);
    expect(file).not.toBeNull();
    if (file === null) return;

    const publique = publicFile(file);

    expect(publique).not.toHaveProperty("subtitlesJson");
    expect(publique.relPath).toBe("media/item1/original-ms1.mkv");
    expect(text(db.prepare("SELECT status FROM files WHERE id = ?").get(o.fileId) ?? {}, "status")).toBe(
      "queued",
    );
  });
});
