//! Ouverture + migrations de la base locale (SQLite via rusqlite, bundled).
//!
//! Migrations par `PRAGMA user_version` : chaque palier est un bloc SQL
//! idempotent appliqué en transaction. Le schéma complet des téléchargements
//! (files/claims/méta/progression) arrive en v2 (phase stockage) — la v1 pose
//! le cache de session hors ligne et les paramètres locaux.

use rusqlite::Connection;
use std::path::{Path, PathBuf};

pub const DB_FILE_NAME: &str = "tentacle-local.db";

/// Chemin de la base : `<app_data_dir>/tentacle-local.db` (créé au besoin).
pub fn db_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    use tauri::Manager;
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir: {e}"))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("create app_data_dir: {e}"))?;
    Ok(dir.join(DB_FILE_NAME))
}

/// Ouvre la base, applique les PRAGMA de rigueur et les migrations.
pub fn open(path: &Path) -> Result<Connection, String> {
    let conn = Connection::open(path).map_err(|e| format!("sqlite open: {e}"))?;
    configure(&conn)?;
    migrate(&conn)?;
    Ok(conn)
}

/// Base en mémoire pour les tests — même schéma que la vraie.
#[cfg(test)]
pub fn open_in_memory() -> Connection {
    let conn = Connection::open_in_memory().expect("sqlite in-memory");
    configure(&conn).expect("configure");
    migrate(&conn).expect("migrate");
    conn
}

fn configure(conn: &Connection) -> Result<(), String> {
    conn.pragma_update(None, "journal_mode", "WAL")
        .map_err(|e| format!("pragma journal_mode: {e}"))?;
    conn.pragma_update(None, "foreign_keys", "ON")
        .map_err(|e| format!("pragma foreign_keys: {e}"))?;
    conn.pragma_update(None, "busy_timeout", 5_000)
        .map_err(|e| format!("pragma busy_timeout: {e}"))?;
    Ok(())
}

const SCHEMA_V1: &str = "
CREATE TABLE IF NOT EXISTS session_cache (
  jellyfin_user_id TEXT PRIMARY KEY,
  profile_json     TEXT NOT NULL,
  policy_json      TEXT,
  cached_at        INTEGER NOT NULL,
  expires_at       INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
";

/// v2 — schéma des téléchargements.
/// `files` = état PHYSIQUE d'un transfert (partagé entre comptes) ;
/// `claims` = référence PAR utilisateur (compteur de références = COUNT) ;
/// `item_meta` = snapshot catalogique ; `playback_state`/`report_queue` =
/// progression locale et resynchronisation différée.
const SCHEMA_V2: &str = "
CREATE TABLE IF NOT EXISTS files (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id          TEXT NOT NULL,
  media_source_id  TEXT NOT NULL,
  variant          TEXT NOT NULL CHECK (variant IN ('original','light')),
  preset           TEXT,
  rel_path         TEXT NOT NULL,
  expected_size    INTEGER,
  bytes_done       INTEGER NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'queued'
                   CHECK (status IN ('queued','downloading','paused','complete','error','canceled')),
  error_code       TEXT,
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS files_identity
  ON files (item_id, media_source_id, variant, COALESCE(preset, ''));

CREATE TABLE IF NOT EXISTS claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jellyfin_user_id TEXT NOT NULL,
  file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  auto_delete_after_watch INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  UNIQUE (jellyfin_user_id, file_id)
);
CREATE INDEX IF NOT EXISTS claims_by_user ON claims (jellyfin_user_id);

CREATE TABLE IF NOT EXISTS item_meta (
  item_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('movie','episode')),
  series_id TEXT,
  season_id TEXT,
  library_id TEXT,
  runtime_ticks INTEGER,
  images_state TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS playback_state (
  jellyfin_user_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  position_ticks INTEGER NOT NULL DEFAULT 0,
  played INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (jellyfin_user_id, item_id)
);

CREATE TABLE IF NOT EXISTS report_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jellyfin_user_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  position_ticks INTEGER NOT NULL,
  played INTEGER NOT NULL DEFAULT 0,
  occurred_at_utc INTEGER NOT NULL,
  synced INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS report_queue_pending ON report_queue (synced, jellyfin_user_id);
";

/// v3 — moteur de téléchargement : distinction pause utilisateur / pause
/// système (coupure réseau, boot) pour l'auto-reprise, et titres dénormalisés
/// dans item_meta (liste des téléchargements sans lire N fichiers JSON).
const SCHEMA_V3: &str = "
ALTER TABLE files ADD COLUMN paused_by_user INTEGER NOT NULL DEFAULT 0;
ALTER TABLE item_meta ADD COLUMN title TEXT;
ALTER TABLE item_meta ADD COLUMN series_name TEXT;
";

/// v4 — mode Allégé : piste audio choisie, sous-titre incrusté (burn-in) et
/// liste des sous-titres texte à télécharger en side-cars (JSON).
const SCHEMA_V4: &str = "
ALTER TABLE files ADD COLUMN audio_stream_index INTEGER;
ALTER TABLE files ADD COLUMN burn_subtitle_index INTEGER;
ALTER TABLE files ADD COLUMN subtitles_json TEXT;
";

fn migrate(conn: &Connection) -> Result<(), String> {
    let version: i64 = conn
        .query_row("PRAGMA user_version", [], |row| row.get(0))
        .map_err(|e| format!("pragma user_version: {e}"))?;
    if version < 1 {
        apply(conn, SCHEMA_V1, 1)?;
    }
    if version < 2 {
        apply(conn, SCHEMA_V2, 2)?;
    }
    if version < 3 {
        apply(conn, SCHEMA_V3, 3)?;
    }
    if version < 4 {
        apply(conn, SCHEMA_V4, 4)?;
    }
    Ok(())
}

/// Lecture d'un paramètre local (racine de stockage, préférences feature).
pub fn setting_get(conn: &Connection, key: &str) -> Result<Option<String>, String> {
    use rusqlite::OptionalExtension;
    conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        rusqlite::params![key],
        |row| row.get(0),
    )
    .optional()
    .map_err(|e| format!("setting get {key}: {e}"))
}

pub fn setting_set(conn: &Connection, key: &str, value: &str) -> Result<(), String> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        rusqlite::params![key, value],
    )
    .map_err(|e| format!("setting set {key}: {e}"))?;
    Ok(())
}

fn apply(conn: &Connection, sql: &str, target: i64) -> Result<(), String> {
    conn.execute_batch(&format!("BEGIN;\n{sql}\nCOMMIT;"))
        .map_err(|e| format!("migration v{target}: {e}"))?;
    conn.pragma_update(None, "user_version", target)
        .map_err(|e| format!("user_version v{target}: {e}"))?;
    Ok(())
}
