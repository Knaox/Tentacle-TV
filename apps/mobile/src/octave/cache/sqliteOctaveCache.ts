/**
 * Octave (mobile) — le stockage des pages gardées : une base SQLite à part
 * (`tentacle_octave_cache.db`), une ligne par clé de requête, écritures par
 * lots dans une transaction. Branché comme PORT du cache commun
 * (`configureOctaveCacheBackend`, api-client) dès le chargement de ce module.
 * Tout échec (base illisible, disque plein) rend un stockage VIDE : Octave
 * s'ouvre alors comme sans cache. Le nom de fichier ne se renomme jamais.
 */

import * as SQLite from "expo-sqlite";
import { configureOctaveCacheBackend, type OctaveCacheBackend, type StoredEntry } from "@tentacle-tv/api-client";

const DB_NAME = "tentacle_octave_cache.db";

function sqliteOctaveCache(): OctaveCacheBackend {
  let opened: Promise<SQLite.SQLiteDatabase | null> | null = null;
  const database = () =>
    (opened ??= SQLite.openDatabaseAsync(DB_NAME)
      .then(async (db) => {
        await db.execAsync("PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS pages (id TEXT PRIMARY KEY NOT NULL, body TEXT NOT NULL);");
        return db;
      })
      .catch(() => null));
  return {
    async loadAll() {
      const db = await database();
      if (!db) return [];
      try {
        const rows = await db.getAllAsync<{ body: string }>("SELECT body FROM pages");
        const entries: StoredEntry[] = [];
        for (const row of rows) {
          try {
            entries.push(JSON.parse(row.body) as StoredEntry);
          } catch {
            /* une ligne illisible ne retient pas les autres */
          }
        }
        return entries;
      } catch {
        return [];
      }
    },
    async put(entries) {
      const db = await database();
      if (!db || entries.length === 0) return;
      try {
        await db.withTransactionAsync(async () => {
          for (const entry of entries) await db.runAsync("INSERT OR REPLACE INTO pages (id, body) VALUES (?, ?)", [entry.id, JSON.stringify(entry)]);
        });
      } catch {
        /* disque plein : la page n'est simplement pas gardée */
      }
    },
    async remove(ids) {
      const db = await database();
      if (!db || ids.length === 0) return;
      try {
        await db.withTransactionAsync(async () => {
          for (const id of ids) await db.runAsync("DELETE FROM pages WHERE id = ?", [id]);
        });
      } catch {
        /* l'éviction recommencera au prochain lancement */
      }
    },
  };
}

configureOctaveCacheBackend(sqliteOctaveCache);
