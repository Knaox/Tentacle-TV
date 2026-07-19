//! Commandes IPC du moteur de téléchargement. Le token n'est JAMAIS persisté :
//! il transite par IPC et reste en mémoire du moteur pour la session.

use super::engine::{Creds, Engine};
use super::{db, fsops, listing, meta, queue, store};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};

fn open_db(app: &AppHandle) -> Result<rusqlite::Connection, String> {
    db::open(&db::db_path(app)?)
}

fn valid_id(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 64
        && value.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
}

fn valid_ext(value: &str) -> bool {
    (1..=5).contains(&value.len()) && value.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnqueueItem {
    pub item_id: String,
    pub media_source_id: String,
    pub variant: String,
    pub preset: Option<String>,
    pub container_ext: String,
    /// Taille EXACTE (Original uniquement — contrôle d'intégrité final).
    pub expected_size: Option<i64>,
    /// Estimation pour le contrôle d'espace (Allégé : durée × débit × 1,15).
    pub estimated_size: Option<i64>,
    pub kind: String,
    pub series_id: Option<String>,
    pub season_id: Option<String>,
    pub library_id: Option<String>,
    pub runtime_ticks: Option<i64>,
    pub title: Option<String>,
    pub series_name: Option<String>,
    pub auto_delete_after_watch: bool,
    /// Mode Allégé : piste audio à embarquer et sous-titre image à incruster.
    pub audio_stream_index: Option<i64>,
    pub burn_subtitle_index: Option<i64>,
    /// Sous-titres texte à récupérer en side-cars (specs JSON-compatibles
    /// avec `subs::SubtitleSpec` : index / format / langTag).
    pub subtitles: Option<Vec<super::subs::SubtitleSpec>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnqueueOutcome {
    pub accepted: bool,
    pub needed_bytes: i64,
    pub free_bytes: u64,
    pub file_ids: Vec<i64>,
}

/// Met en file un lot (film seul ou saison entière). Refus GLOBAL si l'espace
/// libre (marge 2 Gio comprise) ne couvre pas le lot + les transferts déjà
/// promis — rien n'est alors enqueué.
#[tauri::command]
pub fn downloads_enqueue(
    app: AppHandle,
    engine: State<'_, Engine>,
    user_id: String,
    server_url: String,
    token: String,
    items: Vec<EnqueueItem>,
) -> Result<EnqueueOutcome, String> {
    if items.is_empty() {
        return Err("empty-batch".into());
    }
    for item in &items {
        if !valid_id(&item.item_id)
            || !valid_id(&item.media_source_id)
            || !valid_ext(&item.container_ext)
            || !(item.variant == "original" || item.variant == "light")
            || (item.kind != "movie" && item.kind != "episode")
        {
            return Err("invalid-item".into());
        }
        if let Some(preset) = &item.preset {
            if !valid_ext(preset) {
                return Err("invalid-item".into());
            }
        }
    }

    let root = fsops::resolve_root(&app)?;
    let free = fsops::free_space(&root)?;
    let mut conn = open_db(&app)?;

    let mut needed = queue::pending_bytes(&conn)?;
    for item in &items {
        let existing = store::find_file(
            &conn, &item.item_id, &item.media_source_id, &item.variant, item.preset.as_deref(),
        )?;
        let counts = match existing {
            Some((_, ref status)) => status == "canceled",
            None => true,
        };
        if counts {
            needed += item.estimated_size.or(item.expected_size).unwrap_or(0);
        }
    }
    if needed > 0 && !fsops::has_capacity(needed as u64, free) {
        return Ok(EnqueueOutcome { accepted: false, needed_bytes: needed, free_bytes: free, file_ids: vec![] });
    }

    engine.set_creds(&app, Creds { server_url, token });
    let now = super::engine::now_ms();
    let mut file_ids = Vec::with_capacity(items.len());
    for item in &items {
        let rel_path = match item.variant.as_str() {
            "original" => format!(
                "media/{}/original-{}.{}",
                item.item_id, item.media_source_id, item.container_ext
            ),
            _ => format!(
                "media/{}/light-{}-{}.mp4",
                item.item_id,
                item.media_source_id,
                item.preset.as_deref().unwrap_or("p720")
            ),
        };
        meta::upsert_item_meta(
            &conn,
            &meta::MetaSpec {
                item_id: item.item_id.clone(),
                kind: item.kind.clone(),
                series_id: item.series_id.clone(),
                season_id: item.season_id.clone(),
                library_id: item.library_id.clone(),
                runtime_ticks: item.runtime_ticks,
                title: item.title.clone(),
                series_name: item.series_name.clone(),
            },
            now,
        )?;
        let outcome = store::claim_or_create_file(
            &mut conn,
            &user_id,
            &item.item_id,
            &item.media_source_id,
            &item.variant,
            item.preset.as_deref(),
            &rel_path,
            item.expected_size,
            item.auto_delete_after_watch,
            now,
        )?;
        let subtitles_json = match &item.subtitles {
            Some(specs) if !specs.is_empty() => {
                Some(serde_json::to_string(specs).map_err(|e| format!("subs json: {e}"))?)
            }
            _ => None,
        };
        store::set_light_params(
            &conn,
            outcome.file_id,
            item.audio_stream_index,
            item.burn_subtitle_index,
            subtitles_json.as_deref(),
        )?;
        file_ids.push(outcome.file_id);
    }
    drop(conn);
    engine.notify_changed();
    engine.pump();
    Ok(EnqueueOutcome { accepted: true, needed_bytes: needed, free_bytes: free, file_ids })
}

/// Démarrage de session (boot en ligne, login, reconnexion) : credentials +
/// normalisation de la file + relance automatique.
#[tauri::command]
pub fn downloads_engine_start(
    app: AppHandle,
    engine: State<'_, Engine>,
    server_url: String,
    token: String,
) -> Result<(), String> {
    engine.start(&app, Creds { server_url, token })
}

#[tauri::command]
pub fn downloads_pause(app: AppHandle, engine: State<'_, Engine>, file_id: i64) -> Result<(), String> {
    engine.pause(&app, file_id)
}

#[tauri::command]
pub fn downloads_resume(app: AppHandle, engine: State<'_, Engine>, file_id: i64) -> Result<(), String> {
    engine.resume(&app, file_id)
}

#[tauri::command]
pub fn downloads_cancel(app: AppHandle, engine: State<'_, Engine>, file_id: i64) -> Result<(), String> {
    engine.cancel(&app, file_id)
}

/// Suppression PAR CE COMPTE : annule le transfert actif au besoin, retire le
/// claim ; le fichier physique ne part qu'au dernier claim (refcount).
#[tauri::command]
pub fn downloads_delete(
    app: AppHandle,
    engine: State<'_, Engine>,
    user_id: String,
    file_id: i64,
) -> Result<store::DeleteOutcome, String> {
    if engine.is_active(file_id) {
        engine.cancel(&app, file_id)?;
        engine.wait_not_active(file_id, 5_000);
    }
    let root = fsops::resolve_root(&app)?;
    let mut conn = open_db(&app)?;
    let outcome = store::delete_claim(&mut conn, &root, &user_id, file_id)?;
    drop(conn);
    engine.notify_changed();
    Ok(outcome)
}

#[tauri::command]
pub fn downloads_list(
    app: AppHandle,
    user_id: String,
) -> Result<Vec<listing::DownloadListEntry>, String> {
    let conn = open_db(&app)?;
    listing::list_for_user(&conn, &user_id)
}

#[tauri::command]
pub fn downloads_state_for_item(
    app: AppHandle,
    user_id: String,
    item_id: String,
) -> Result<Option<listing::DownloadListEntry>, String> {
    let conn = open_db(&app)?;
    listing::state_for_item(&conn, &user_id, &item_id)
}

#[tauri::command]
pub fn downloads_set_auto_delete(
    app: AppHandle,
    engine: State<'_, Engine>,
    user_id: String,
    file_id: i64,
    enabled: bool,
) -> Result<(), String> {
    let conn = open_db(&app)?;
    listing::set_auto_delete(&conn, &user_id, file_id, enabled)?;
    drop(conn);
    engine.notify_changed();
    Ok(())
}
