/**
 * La base locale n'est pas neuve : c'est celle que l'app Tauri a déjà créée
 * chez l'utilisateur. Ces tests vérifient les deux choses qui comptent — qu'une
 * base ancienne monte jusqu'au dernier palier sans rien perdre, et qu'une base
 * à jour n'est pas retouchée.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { dbPath, open, openInMemory, settingGet, settingSet, userVersion } from "./db";
import { SCHEMA_VERSION } from "./schema";
import { integer, text } from "./rows";

const dossiers: string[] = [];

function dossierTemporaire(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "tentacle-db-"));
  dossiers.push(dir);
  return dir;
}

afterEach(() => {
  while (dossiers.length > 0) {
    const dir = dossiers.pop();
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  }
});

/** Noms des tables présentes, triés. */
function tables(db: DatabaseSync): string[] {
  return db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all()
    .map((row) => text(row, "name"))
    .filter((name) => !name.startsWith("sqlite_"));
}

describe("migrations", () => {
  it("une base neuve monte au dernier palier", () => {
    const db = openInMemory();
    expect(userVersion(db)).toBe(SCHEMA_VERSION);
    expect(tables(db)).toEqual([
      "claims",
      "files",
      "item_meta",
      "playback_state",
      "report_queue",
      "session_cache",
      "settings",
    ]);
  });

  it("une base deja a jour n'est pas retouchee", () => {
    const file = dbPath(dossierTemporaire());

    const premier = open(file);
    settingSet(premier, "storage_root", "D:/films");
    premier.close();

    const second = open(file);
    expect(userVersion(second)).toBe(SCHEMA_VERSION);
    expect(settingGet(second, "storage_root")).toBe("D:/films");
    second.close();
  });

  it("une base ancienne monte sans perdre ses donnees", () => {
    const file = dbPath(dossierTemporaire());

    // Une v1 telle que la livrait la toute première version : session et
    // paramètres, rien d'autre. Le SQL est recopié ici plutôt qu'importé —
    // sinon le test validerait la constante par elle-même.
    const ancienne = new DatabaseSync(file);
    ancienne.exec(`
      CREATE TABLE session_cache (
        jellyfin_user_id TEXT PRIMARY KEY,
        profile_json     TEXT NOT NULL,
        policy_json      TEXT,
        cached_at        INTEGER NOT NULL,
        expires_at       INTEGER NOT NULL
      );
      CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `);
    ancienne
      .prepare("INSERT INTO session_cache VALUES (?, ?, ?, ?, ?)")
      .run("u-1", '{"Name":"damien"}', null, 1_000, 2_000);
    ancienne.exec("PRAGMA user_version = 1");
    ancienne.close();

    const migree = open(file);
    expect(userVersion(migree)).toBe(SCHEMA_VERSION);

    // La session d'origine est intacte...
    const row = migree.prepare("SELECT profile_json FROM session_cache WHERE jellyfin_user_id = ?").get("u-1");
    expect(row).toBeDefined();
    expect(text(row ?? {}, "profile_json")).toBe('{"Name":"damien"}');

    // ...et les colonnes ajoutées par les paliers suivants sont là.
    migree.exec(`
      INSERT INTO files (item_id, media_source_id, variant, rel_path, created_at, updated_at,
                         paused_by_user, audio_stream_index)
      VALUES ('i1', 'ms1', 'light', 'media/i1/light-ms1-p720.mp4', 1, 1, 1, 3)
    `);
    migree.exec(`
      INSERT INTO claims (jellyfin_user_id, file_id, created_at, auto_delete_delay_minutes)
      VALUES ('u-1', 1, 1, 30)
    `);
    migree.close();
  });
});

describe("contraintes du schema", () => {
  const insertFile = `
    INSERT INTO files (item_id, media_source_id, variant, preset, rel_path, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, 1)`;

  it("le CHECK sur la variante est actif", () => {
    const db = openInMemory();
    expect(() =>
      db.prepare(insertFile).run("i1", "ms1", "bogus", null, "media/i1/x.mkv"),
    ).toThrow(/CHECK constraint failed/);
  });

  it("l'index d'identite refuse un doublon, preset nul compris", () => {
    const db = openInMemory();
    db.prepare(insertFile).run("i1", "ms1", "original", null, "media/i1/original-ms1.mkv");
    expect(() =>
      db.prepare(insertFile).run("i1", "ms1", "original", null, "media/i1/original-ms1.mkv"),
    ).toThrow(/UNIQUE constraint failed/);

    // Même item, même source, mais une variante allégée : identité distincte.
    db.prepare(insertFile).run("i1", "ms1", "light", "p720", "media/i1/light-ms1-p720.mp4");
    expect(integer(db.prepare("SELECT COUNT(*) AS n FROM files").get() ?? {}, "n")).toBe(2);
  });

  it("supprimer un fichier emporte ses claims", () => {
    const db = openInMemory();
    db.prepare(insertFile).run("i1", "ms1", "original", null, "media/i1/original-ms1.mkv");
    db.prepare("INSERT INTO claims (jellyfin_user_id, file_id, created_at) VALUES (?, ?, 1)").run("u-1", 1);
    db.exec("DELETE FROM files WHERE id = 1");
    expect(integer(db.prepare("SELECT COUNT(*) AS n FROM claims").get() ?? {}, "n")).toBe(0);
  });

  it("les ticks Jellyfin traversent sans perte", () => {
    const db = openInMemory();
    // 10 h en ticks (100 ns) : au-delà de ce que compte un film, et bien en
    // deçà de la plage sûre d'un double.
    const ticks = 360_000_000_000;
    db.prepare(
      "INSERT INTO item_meta (item_id, kind, runtime_ticks, created_at, updated_at) VALUES (?, 'movie', ?, 1, 1)",
    ).run("i1", ticks);
    expect(integer(db.prepare("SELECT runtime_ticks FROM item_meta").get() ?? {}, "runtime_ticks")).toBe(ticks);
  });
});

describe("parametres locaux", () => {
  it("ecriture, relecture, ecrasement", () => {
    const db = openInMemory();
    expect(settingGet(db, "storage_root")).toBeNull();
    settingSet(db, "storage_root", "D:/films");
    expect(settingGet(db, "storage_root")).toBe("D:/films");
    settingSet(db, "storage_root", "E:/films");
    expect(settingGet(db, "storage_root")).toBe("E:/films");
  });
});
