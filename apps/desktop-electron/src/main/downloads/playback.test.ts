/**
 * Transposition de `playback_tests.rs`.
 *
 * Le contrôle d'intégrité à CHAQUE lecture est ce qui distingue un
 * téléchargement marqué en défaut d'un lecteur qui s'ouvre sur du vide — et il
 * ne se déclenche que le jour où un fichier a été touché hors de
 * l'application.
 */

import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { openInMemory } from "./db";
import {
  localSource,
  markItemSynced,
  pendingReports,
  restartPlayback,
  setPlaybackState,
} from "./playback";
import { getFile } from "./queue";
import { claimOrCreateFile } from "./store";
import { writeMedia, preparedRoot, spec } from "./testkit";

const REL = "media/item1/original-ms1.mkv";

function seedComplete(db: DatabaseSync, size: number): number {
  const fileId = claimOrCreateFile(db, spec({ expectedSize: size })).fileId;
  db.prepare("UPDATE files SET status = 'complete', bytes_done = ? WHERE id = ?").run(size, fileId);
  return fileId;
}

describe("source locale", () => {
  it("rend le chemin, la progression et les sous-titres", () => {
    const root = preparedRoot("tentacle-playback-");
    writeMedia(root, REL, "1234");
    writeMedia(root, "media/item1/subs/3-fre.srt", "1");
    writeMedia(root, "media/item1/subs/1-eng.srt", "1");
    const db = openInMemory();
    seedComplete(db, 4);
    setPlaybackState(db, "u", "item1", 5_000, false, false, 2_000);

    const source = localSource(db, root, "u", "item1", 3_000);

    expect(source?.absolutePath).toBe(path.join(root, REL));
    expect(source?.positionTicks).toBe(5_000);
    expect(source?.played).toBe(false);
    // Ordre stable, sinon la piste par defaut changerait d'une lecture a l'autre.
    expect(source?.subtitleFiles.map((s) => s.fileName)).toEqual(["1-eng.srt", "3-fre.srt"]);
  });

  it("est cloisonnee par utilisateur", () => {
    const root = preparedRoot("tentacle-playback-");
    writeMedia(root, REL, "1234");
    const db = openInMemory();
    seedComplete(db, 4);

    expect(localSource(db, root, "u", "item1", 3_000)).not.toBeNull();
    expect(localSource(db, root, "autre", "item1", 3_000)).toBeNull();
  });

  it("un fichier tronque hors application est marque en defaut", () => {
    const root = preparedRoot("tentacle-playback-");
    writeMedia(root, REL, "12"); // 2 octets au lieu de 4
    const db = openInMemory();
    const fileId = seedComplete(db, 4);

    expect(localSource(db, root, "u", "item1", 3_000)).toBeNull();

    const file = getFile(db, fileId);
    expect(file?.status).toBe("error");
    expect(file?.errorCode).toBe("integrity");
  });

  it("un fichier disparu est marque manquant", () => {
    const root = preparedRoot("tentacle-playback-");
    const db = openInMemory();
    const fileId = seedComplete(db, 4);

    expect(localSource(db, root, "u", "item1", 3_000)).toBeNull();

    expect(getFile(db, fileId)?.errorCode).toBe("missing");
  });

  it("l'Allege n'est pas soumis au controle de taille", () => {
    const root = preparedRoot("tentacle-playback-");
    const rel = "media/item1/light-ms1-p720.mp4";
    writeMedia(root, rel, "court");
    const db = openInMemory();
    const fileId = claimOrCreateFile(
      db,
      spec({ variant: "light", preset: "p720", relPath: rel, expectedSize: 99 }),
    ).fileId;
    db.prepare("UPDATE files SET status = 'complete' WHERE id = ?").run(fileId);

    // La taille d'un transcodage n'est pas connue d'avance.
    expect(localSource(db, root, "u", "item1", 3_000)).not.toBeNull();
  });

  it("la meta denormalisee accompagne la source", () => {
    const root = preparedRoot("tentacle-playback-");
    writeMedia(root, REL, "1234");
    const db = openInMemory();
    seedComplete(db, 4);
    db.prepare(
      `INSERT INTO item_meta (item_id, kind, series_name, title, index_number,
                              parent_index_number, library_id, created_at, updated_at)
       VALUES ('item1', 'episode', 'Une serie', 'Un episode', 4, 2, 'lib-1', 1, 1)`,
    ).run();

    const source = localSource(db, root, "u", "item1", 3_000);

    // Le lecteur reste presentable en demarrage 100 % hors ligne.
    expect(source?.seriesName).toBe("Une serie");
    expect(source?.indexNumber).toBe(4);
    expect(source?.parentIndexNumber).toBe(2);
    expect(source?.libraryId).toBe("lib-1");
  });
});

describe("progression et resynchronisation", () => {
  it("hors ligne, chaque etat rejoint la file", () => {
    const db = openInMemory();
    setPlaybackState(db, "u", "item1", 1_000, false, true, 2_000);
    setPlaybackState(db, "u", "item1", 9_000, true, true, 3_000);

    const queued = db.prepare("SELECT COUNT(*) AS n FROM report_queue WHERE synced = 0").get();
    expect(Number(queued?.["n"])).toBe(2);
  });

  it("« vu » ne redescend jamais", () => {
    const db = openInMemory();
    setPlaybackState(db, "u", "item1", 9_000, true, false, 3_000);
    // Relecture depuis le debut : la position recule, le fait d'avoir vu non.
    setPlaybackState(db, "u", "item1", 100, false, false, 4_000);

    const row = db.prepare("SELECT played FROM playback_state WHERE item_id = 'item1'").get();
    expect(Number(row?.["played"])).toBe(1);
  });

  it("le drain deduplique par item et marque l'historique", () => {
    const db = openInMemory();
    setPlaybackState(db, "u", "item1", 1_000, false, true, 2_000);
    setPlaybackState(db, "u", "item1", 9_000, true, true, 3_000);
    setPlaybackState(db, "u", "item2", 4_000, false, true, 4_000);
    setPlaybackState(db, "autre", "item1", 7_000, false, true, 5_000);

    const pending = pendingReports(db, "u");

    expect(pending).toHaveLength(2); // un seul rapport par item, cloisonne
    const item1 = pending.find((r) => r.itemId === "item1");
    expect(item1?.positionTicks).toBe(9_000); // le plus recent gagne
    expect(item1?.played).toBe(true);

    markItemSynced(db, "u", "item1", item1?.id ?? 0);

    const rest = pendingReports(db, "u");
    expect(rest).toHaveLength(1);
    expect(rest[0]?.itemId).toBe("item2");
    // Le compte « autre » n'est pas touche.
    expect(pendingReports(db, "autre")).toHaveLength(1);
  });

  it("une lecture en ligne n'alimente pas la file", () => {
    const db = openInMemory();
    setPlaybackState(db, "u", "item1", 1_000, false, false, 2_000);
    expect(pendingReports(db, "u")).toEqual([]);
  });
});

/**
 * Sans cette voie explicite, revoir un episode en deux fois serait impossible :
 * `played` ne redescend jamais par `setPlaybackState`, et la reprise ignore la
 * position d'un item vu -- on repartirait de zero a CHAQUE ouverture.
 */
describe("recommencer un item vu", () => {
  it("remet la progression a neuf", () => {
    const db = openInMemory();
    setPlaybackState(db, "u", "item1", 9_000, true, false, 2_000);

    restartPlayback(db, "u", "item1", 5_000);

    const state = db
      .prepare("SELECT position_ticks, played, updated_at FROM playback_state WHERE item_id = ?")
      .get("item1");
    expect(state?.position_ticks).toBe(0);
    expect(state?.played).toBe(0);
    expect(state?.updated_at).toBe(5_000);
  });

  it("leve l'echeance de suppression", () => {
    // Elle avait ete posee parce que l'item etait vu : la laisser ferait
    // disparaitre le fichier au milieu du re-visionnage.
    const db = openInMemory();
    const fileId = claimOrCreateFile(db, spec({ autoDeleteAfterWatch: true })).fileId;
    db.prepare("UPDATE claims SET delete_scheduled_at = 42 WHERE file_id = ?").run(fileId);
    setPlaybackState(db, "u", "item1", 9_000, true, false, 2_000);

    restartPlayback(db, "u", "item1", 5_000);

    const claim = db.prepare("SELECT delete_scheduled_at FROM claims WHERE file_id = ?").get(fileId);
    expect(claim?.delete_scheduled_at).toBeNull();
  });

  it("n'alimente PAS la file de resynchronisation", () => {
    // Jellyfin ne de-marque pas un episode parce qu'on le relance.
    const db = openInMemory();
    setPlaybackState(db, "u", "item1", 9_000, true, true, 2_000);
    const before = pendingReports(db, "u");

    restartPlayback(db, "u", "item1", 5_000);

    expect(pendingReports(db, "u")).toEqual(before);
  });

  it("ne touche pas au meme item d'un AUTRE compte", () => {
    const db = openInMemory();
    setPlaybackState(db, "u", "item1", 9_000, true, false, 2_000);
    setPlaybackState(db, "autre", "item1", 8_000, true, false, 2_000);

    restartPlayback(db, "u", "item1", 5_000);

    const other = db
      .prepare("SELECT position_ticks, played FROM playback_state WHERE jellyfin_user_id = ?")
      .get("autre");
    expect(other?.position_ticks).toBe(8_000);
    expect(other?.played).toBe(1);
  });

  it("ne cree rien pour un item jamais lu", () => {
    const db = openInMemory();
    restartPlayback(db, "u", "item1", 5_000);
    expect(db.prepare("SELECT COUNT(*) AS n FROM playback_state").get()?.n).toBe(0);
  });
});
