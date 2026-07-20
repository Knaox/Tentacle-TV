//! Commandes IPC du socle Hors ligne. Ouverture SQLite courte par appel —
//! suffisant pour les opérations de session ; le moteur de téléchargement
//! (phase ultérieure) aura son propre état managé longue durée.

use super::{db, fsops, localserver, playback, session, store};
use serde::Serialize;
use tauri::{AppHandle, State};

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

/* ---- Stockage : racine, espace, occupation ---- */

#[tauri::command]
pub fn downloads_get_root(app: AppHandle) -> Result<String, String> {
    Ok(fsops::resolve_root(&app)?.to_string_lossy().into_owned())
}

/// Codes d'erreur stables : `root-not-empty`, `root-not-writable`.
#[tauri::command]
pub fn downloads_set_root(
    app: AppHandle,
    cache: State<'_, fsops::RootCache>,
    path: String,
) -> Result<String, String> {
    let conn = open_db(&app)?;
    let new_root = fsops::set_root(&conn, &cache, std::path::Path::new(&path))?;
    Ok(new_root.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn downloads_disk_free(app: AppHandle) -> Result<u64, String> {
    let root = fsops::resolve_root(&app)?;
    fsops::free_space(&root)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetBase {
    pub base: String,
    pub token: String,
}

/// Base + jeton du serveur loopback qui sert affiches/méta/trickplay locaux.
/// Démarre le serveur au premier appel (idempotent).
#[tauri::command]
pub fn downloads_asset_base(app: AppHandle) -> Result<AssetBase, String> {
    let server = localserver::ensure_started(&app)?;
    Ok(AssetBase {
        base: format!("http://127.0.0.1:{}", server.port),
        token: server.token.clone(),
    })
}

#[tauri::command]
pub fn downloads_disk_usage(app: AppHandle) -> Result<i64, String> {
    let conn = open_db(&app)?;
    store::disk_usage(&conn)
}

/* ---- Lecture locale ---- */

fn now_ms_pub() -> i64 {
    now_ms()
}

/// Source locale LISIBLE pour un item (fichier revérifié sur disque),
/// avec side-cars de sous-titres et progression locale.
#[tauri::command]
pub fn downloads_local_source(
    app: AppHandle,
    user_id: String,
    item_id: String,
) -> Result<Option<playback::LocalSource>, String> {
    let root = fsops::resolve_root(&app)?;
    let conn = open_db(&app)?;
    playback::local_source(&conn, &root, &user_id, &item_id, now_ms_pub())
}

/// Progression locale ; `queue_for_sync` = lecture hors ligne (resynchro
/// différée vers Jellyfin au retour en ligne).
#[tauri::command]
pub fn downloads_playback_set(
    app: AppHandle,
    user_id: String,
    item_id: String,
    position_ticks: i64,
    played: bool,
    queue_for_sync: bool,
) -> Result<(), String> {
    let conn = open_db(&app)?;
    playback::set_playback_state(
        &conn, &user_id, &item_id, position_ticks, played, queue_for_sync, now_ms_pub(),
    )
}

/// File de resynchronisation (dédupliquée : dernier état par item).
#[tauri::command]
pub fn downloads_reports_pending(
    app: AppHandle,
    user_id: String,
) -> Result<Vec<playback::PendingReport>, String> {
    let conn = open_db(&app)?;
    playback::pending_reports(&conn, &user_id)
}

#[tauri::command]
pub fn downloads_reports_mark_synced(
    app: AppHandle,
    user_id: String,
    item_id: String,
    up_to_id: i64,
) -> Result<(), String> {
    let conn = open_db(&app)?;
    playback::mark_item_synced(&conn, &user_id, &item_id, up_to_id)
}
