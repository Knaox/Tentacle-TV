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

fn migrate(conn: &Connection) -> Result<(), String> {
    let version: i64 = conn
        .query_row("PRAGMA user_version", [], |row| row.get(0))
        .map_err(|e| format!("pragma user_version: {e}"))?;
    if version < 1 {
        apply(conn, SCHEMA_V1, 1)?;
    }
    Ok(())
}

fn apply(conn: &Connection, sql: &str, target: i64) -> Result<(), String> {
    conn.execute_batch(&format!("BEGIN;\n{sql}\nCOMMIT;"))
        .map_err(|e| format!("migration v{target}: {e}"))?;
    conn.pragma_update(None, "user_version", target)
        .map_err(|e| format!("user_version v{target}: {e}"))?;
    Ok(())
}
