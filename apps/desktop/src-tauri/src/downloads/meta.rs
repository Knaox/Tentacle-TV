//! Snapshot catalogique d'un item au moment du téléchargement : DTO Jellyfin
//! (item + série + saison) et images (affiche, backdrop, logo) enregistrés
//! sous `meta/<itemId>/` — tout passe par le PROXY Tentacle avec le token de
//! l'utilisateur en header (jamais en query). Best-effort : un échec d'image
//! ne bloque jamais le transfert média ; `images_state` trace ce qui a réussi.

use super::fsops;
use rusqlite::{params, Connection, OptionalExtension};
use std::io::Read;
use std::path::Path;

#[derive(Debug, Clone)]
pub struct MetaSpec {
    pub item_id: String,
    pub kind: String, // "movie" | "episode"
    pub series_id: Option<String>,
    pub season_id: Option<String>,
    pub library_id: Option<String>,
    pub runtime_ticks: Option<i64>,
    pub title: Option<String>,
    pub series_name: Option<String>,
}

pub fn upsert_item_meta(conn: &Connection, spec: &MetaSpec, now_ms: i64) -> Result<(), String> {
    conn.execute(
        "INSERT INTO item_meta (item_id, kind, series_id, season_id, library_id,
                                runtime_ticks, title, series_name, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)
         ON CONFLICT(item_id) DO UPDATE SET
           kind = excluded.kind,
           series_id = excluded.series_id,
           season_id = excluded.season_id,
           library_id = excluded.library_id,
           runtime_ticks = excluded.runtime_ticks,
           title = COALESCE(excluded.title, item_meta.title),
           series_name = COALESCE(excluded.series_name, item_meta.series_name),
           updated_at = excluded.updated_at",
        params![
            spec.item_id, spec.kind, spec.series_id, spec.season_id, spec.library_id,
            spec.runtime_ticks, spec.title, spec.series_name, now_ms
        ],
    )
    .map_err(|e| format!("upsert item_meta: {e}"))?;
    Ok(())
}

fn save_bytes(root: &Path, rel: &str, bytes: &[u8]) -> Result<(), String> {
    let path = fsops::safe_join(root, rel)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("mkdir meta: {e}"))?;
    }
    std::fs::write(&path, bytes).map_err(|e| format!("write {rel}: {e}"))
}

fn fetch_to_vec(agent: &ureq::Agent, url: &str, token: &str) -> Result<Vec<u8>, String> {
    // X-Emby-Token : format d'auth du proxy /api/jellyfin (transmis tel quel à
    // Jellyfin). Un `Bearer` n'est PAS compris par Jellyfin → 401 silencieux
    // (c'est ce qui laissait les snapshots JSON vides).
    let response = agent
        .get(url)
        .set("X-Emby-Token", token)
        .call()
        .map_err(|e| format!("GET: {e}"))?;
    let mut bytes = Vec::new();
    response
        .into_reader()
        .take(20 * 1024 * 1024)
        .read_to_end(&mut bytes)
        .map_err(|e| format!("read: {e}"))?;
    Ok(bytes)
}

/// Télécharge et enregistre le snapshot complet. Retourne le résumé
/// `images_state` (JSON) écrit aussi dans `item_meta`.
pub fn snapshot(
    agent: &ureq::Agent,
    server_url: &str,
    token: &str,
    root: &Path,
    conn: &Connection,
    spec: &MetaSpec,
) -> Result<(), String> {
    let base = format!("{server_url}/api/jellyfin");
    let dir = format!("meta/{}", spec.item_id);
    let mut ok_parts: Vec<&str> = Vec::new();

    // DTO de l'item + parents (épisodes) — JSON bruts, relus hors ligne.
    // `fields=Trickplay` : le manifeste des aperçus est opt-in.
    let json_targets: Vec<(String, String)> = {
        let mut targets = vec![(
            format!("{base}/Items/{}?fields=Trickplay", spec.item_id),
            format!("{dir}/item.json"),
        )];
        if let Some(series) = &spec.series_id {
            targets.push((format!("{base}/Items/{series}"), format!("{dir}/series.json")));
        }
        if let Some(season) = &spec.season_id {
            targets.push((format!("{base}/Items/{season}"), format!("{dir}/season.json")));
        }
        targets
    };
    let mut item_json: Vec<u8> = Vec::new();
    for (url, rel) in &json_targets {
        if let Ok(bytes) = fetch_to_vec(agent, url, token) {
            if save_bytes(root, rel, &bytes).is_ok() {
                if rel.ends_with("item.json") {
                    item_json = bytes;
                    ok_parts.push("item");
                } else if rel.ends_with("series.json") {
                    ok_parts.push("series");
                } else {
                    ok_parts.push("season");
                }
            }
        }
    }

    // Tuiles trickplay (aperçu au survol) — depuis le manifeste de item.json.
    if !item_json.is_empty() {
        let media_source_id = super::store::first_media_source_id(conn, &spec.item_id)
            .unwrap_or_else(|| spec.item_id.clone());
        let saved = super::trickplay::download(
            agent, server_url, token, root, &spec.item_id, &media_source_id, &item_json,
        );
        if saved > 0 {
            ok_parts.push("trickplay");
        }
    }

    // Images — l'affiche de l'épisode, le backdrop/logo côté série pour les
    // épisodes (rendu de fiche cohérent hors ligne).
    let visual_source = spec.series_id.as_deref().unwrap_or(&spec.item_id);
    let image_targets: Vec<(String, String, &str)> = vec![
        (
            format!("{base}/Items/{}/Images/Primary?maxWidth=600&quality=90&format=Jpg", spec.item_id),
            format!("{dir}/primary.jpg"),
            "primary",
        ),
        (
            format!("{base}/Items/{visual_source}/Images/Backdrop?maxWidth=1280&quality=90&format=Jpg"),
            format!("{dir}/backdrop.jpg"),
            "backdrop",
        ),
        (
            format!("{base}/Items/{visual_source}/Images/Logo?maxWidth=800&format=Png"),
            format!("{dir}/logo.png"),
            "logo",
        ),
    ];
    for (url, rel, label) in &image_targets {
        if let Ok(bytes) = fetch_to_vec(agent, url, token) {
            if !bytes.is_empty() && save_bytes(root, rel, &bytes).is_ok() {
                ok_parts.push(label);
            }
        }
    }
    if let Some(series) = &spec.series_id {
        let url = format!("{base}/Items/{series}/Images/Primary?maxWidth=600&quality=90&format=Jpg");
        if let Ok(bytes) = fetch_to_vec(agent, &url, token) {
            if save_bytes(root, &format!("{dir}/series-primary.jpg"), &bytes).is_ok() {
                ok_parts.push("seriesPrimary");
            }
        }
    }

    // Bibliothèque (CollectionFolder de premier niveau) via Ancestors — sert
    // aux préférences de pistes par bibliothèque en mode hors ligne.
    if let Ok(bytes) = fetch_to_vec(agent, &format!("{base}/Items/{}/Ancestors", spec.item_id), token) {
        if let Ok(ancestors) = serde_json::from_slice::<Vec<serde_json::Value>>(&bytes) {
            let library_id = ancestors
                .iter()
                .rev()
                .find(|a| a.get("Type").and_then(|t| t.as_str()) == Some("CollectionFolder"))
                .and_then(|a| a.get("Id").and_then(|id| id.as_str()))
                .map(str::to_owned);
            if let Some(library_id) = library_id {
                conn.execute(
                    "UPDATE item_meta SET library_id = ?2 WHERE item_id = ?1",
                    params![spec.item_id, library_id],
                )
                .ok();
                ok_parts.push("library");
            }
        }
    }

    let state = format!(
        "{{\"ok\":[{}]}}",
        ok_parts
            .iter()
            .map(|p| format!("\"{p}\""))
            .collect::<Vec<_>>()
            .join(",")
    );
    conn.execute(
        "UPDATE item_meta SET images_state = ?2, updated_at = ?3 WHERE item_id = ?1",
        params![spec.item_id, state, now_ms_helper()],
    )
    .map_err(|e| format!("images_state: {e}"))?;
    Ok(())
}

/// Relit le spec catalogique depuis `item_meta` (posé à l'enqueue).
pub fn get_spec(conn: &Connection, item_id: &str) -> Result<Option<MetaSpec>, String> {
    conn.query_row(
        "SELECT item_id, kind, series_id, season_id, library_id, runtime_ticks, title, series_name
         FROM item_meta WHERE item_id = ?1",
        params![item_id],
        |row| {
            Ok(MetaSpec {
                item_id: row.get(0)?,
                kind: row.get(1)?,
                series_id: row.get(2)?,
                season_id: row.get(3)?,
                library_id: row.get(4)?,
                runtime_ticks: row.get(5)?,
                title: row.get(6)?,
                series_name: row.get(7)?,
            })
        },
    )
    .optional()
    .map_err(|e| format!("get spec: {e}"))
}

/// Le snapshot est-il déjà présent (item.json) ?
pub fn snapshot_exists(root: &Path, item_id: &str) -> bool {
    meta_file_exists(root, item_id, "item.json")
}

/// L'affiche VERTICALE de la série est-elle là ? Elle illustre les groupes
/// « série · saison » du catalogue hors ligne ; les téléchargements antérieurs
/// à son ajout ne l'ont pas (d'où le re-snapshot par `heal`).
pub fn series_primary_exists(root: &Path, item_id: &str) -> bool {
    meta_file_exists(root, item_id, "series-primary.jpg")
}

fn meta_file_exists(root: &Path, item_id: &str, name: &str) -> bool {
    fsops::safe_join(root, &format!("meta/{item_id}/{name}"))
        .map(|p| p.exists())
        .unwrap_or(false)
}

fn now_ms_helper() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}
