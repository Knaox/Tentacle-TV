//! Auto-réparation des à-côtés d'un téléchargement : snapshots (item.json,
//! affiches) et side-cars de sous-titres manquants pour les fichiers DÉJÀ
//! complets. Lancée en tâche de fond à chaque démarrage du moteur (en ligne) —
//! idempotente (tout ce qui existe est sauté), best-effort, et répare
//! notamment les téléchargements faits avant un correctif de récupération.

use super::{db, engine::Creds, fsops, meta, subs};
use rusqlite::Connection;
use tauri::{AppHandle, Emitter};

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
        if !meta::snapshot_exists(&root, &item_id) {
            if let Ok(Some(spec)) = meta::get_spec(&conn, &item_id) {
                if meta::snapshot(&agent, &creds.server_url, &creds.token, &root, &conn, &spec)
                    .is_ok()
                {
                    touched = true;
                }
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
