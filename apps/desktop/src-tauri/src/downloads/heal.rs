//! Auto-réparation des à-côtés d'un téléchargement : snapshots (item.json,
//! affiches) et side-cars de sous-titres manquants pour les fichiers DÉJÀ
//! complets. Lancée en tâche de fond à chaque démarrage du moteur (en ligne) —
//! idempotente (tout ce qui existe est sauté), best-effort, et répare
//! notamment les téléchargements faits avant un correctif de récupération.

use super::{db, engine::Creds, fsops, meta, store, subs, trickplay};
use rusqlite::Connection;
use tauri::{AppHandle, Emitter};

fn fetch_json(agent: &ureq::Agent, url: &str, token: &str) -> Result<Vec<u8>, String> {
    use std::io::Read;
    let response = agent
        .get(url)
        .set("X-Emby-Token", token)
        .call()
        .map_err(|e| format!("GET: {e}"))?;
    let mut bytes = Vec::new();
    response
        .into_reader()
        .take(8 * 1024 * 1024)
        .read_to_end(&mut bytes)
        .map_err(|e| format!("read: {e}"))?;
    Ok(bytes)
}

fn complete_files(conn: &Connection) -> Vec<(String, String, Option<String>)> {
    let Ok(mut stmt) = conn.prepare(
        "SELECT DISTINCT item_id, media_source_id, subtitles_json
         FROM files WHERE status = 'complete'",
    ) else {
        return Vec::new();
    };
    let Ok(rows) = stmt.query_map([], |row| {
        Ok((row.get(0)?, row.get(1)?, row.get(2)?))
    }) else {
        return Vec::new();
    };
    rows.flatten().collect()
}

/// Corps de la réparation (thread de fond). Retourne le nombre d'items touchés.
pub fn run(app: &AppHandle, creds: &Creds) -> usize {
    let Ok(db_path) = db::db_path(app) else { return 0 };
    let Ok(conn) = db::open(&db_path) else { return 0 };
    let Ok(root) = fsops::resolve_root(app) else { return 0 };
    let agent = ureq::AgentBuilder::new()
        .timeout(std::time::Duration::from_secs(20))
        .build();

    let mut healed = 0;
    for (item_id, media_source_id, subtitles_json) in complete_files(&conn) {
        let mut touched = false;
        // Snapshot absent, affiche de série manquante, ou snapshot d'une
        // version antérieure (sans segments.json / DTO enrichi) : un
        // re-snapshot complet répare tout, il saute ce qui est déjà en place.
        if let Ok(Some(spec)) = meta::get_spec(&conn, &item_id) {
            let missing_series_poster =
                spec.series_id.is_some() && !meta::series_primary_exists(&root, &item_id);
            let outdated_meta = meta::meta_version(&conn, &item_id) < meta::CURRENT_META_VERSION;
            let needs_snapshot = !meta::snapshot_exists(&root, &item_id)
                || missing_series_poster
                || outdated_meta;
            if needs_snapshot
                && meta::snapshot(&agent, &creds.server_url, &creds.token, &root, &conn, &spec)
                    .is_ok()
            {
                touched = true;
            }
        }
        // Trickplay manquant (téléchargements d'avant ce correctif) : récupérer
        // le manifeste (fields=Trickplay) puis les planches.
        if !trickplay::exists(&root, &item_id) {
            let url = format!("{}/api/jellyfin/Items/{item_id}?fields=Trickplay", creds.server_url);
            if let Ok(item_json) = fetch_json(&agent, &url, &creds.token) {
                let msrc = store::first_media_source_id(&conn, &item_id)
                    .unwrap_or_else(|| item_id.clone());
                let saved = trickplay::download(
                    &agent, &creds.server_url, &creds.token, &root, &item_id, &msrc, &item_json,
                );
                touched = touched || saved > 0;
            }
        }
        if let Some(json) = &subtitles_json {
            let specs = subs::parse_specs(json);
            if !specs.is_empty() {
                // fetch_all saute les fichiers déjà présents (idempotent).
                let fetched = subs::fetch_all(
                    &agent, &creds.server_url, &creds.token, &root, &item_id,
                    &media_source_id, &specs,
                );
                touched = touched || fetched > 0;
            }
        }
        if touched {
            healed += 1;
        }
    }
    if healed > 0 {
        let _ = app.emit(super::engine::EVENT_CHANGED, ());
    }
    healed
}

/// Variante détachée (démarrage du moteur).
pub fn spawn(app: AppHandle, creds: Creds) {
    std::thread::spawn(move || {
        let _ = run(&app, &creds);
    });
}
