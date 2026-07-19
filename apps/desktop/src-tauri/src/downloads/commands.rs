//! Commandes IPC du socle Hors ligne. Ouverture SQLite courte par appel —
//! suffisant pour les opérations de session ; le moteur de téléchargement
//! (phase ultérieure) aura son propre état managé longue durée.

use super::{db, session};
use tauri::AppHandle;

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn open_db(app: &AppHandle) -> Result<rusqlite::Connection, String> {
    db::open(&db::db_path(app)?)
}

#[tauri::command]
pub fn session_cache_get(
    app: AppHandle,
    user_id: String,
) -> Result<Option<session::CachedSession>, String> {
    let conn = open_db(&app)?;
    session::get(&conn, &user_id, now_ms())
}

#[tauri::command]
pub fn session_cache_set(
    app: AppHandle,
    user_id: String,
    profile_json: String,
    policy_json: Option<String>,
) -> Result<(), String> {
    let conn = open_db(&app)?;
    session::set(&conn, &user_id, &profile_json, policy_json.as_deref(), now_ms())
}

#[tauri::command]
pub fn session_cache_clear(app: AppHandle, user_id: String) -> Result<(), String> {
    let conn = open_db(&app)?;
    session::clear(&conn, &user_id)
}
