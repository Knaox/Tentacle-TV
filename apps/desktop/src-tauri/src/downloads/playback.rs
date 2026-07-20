//! Résolution de source à la lecture + progression locale.
//! `local_source` revérifie le fichier À CHAQUE lecture (existence + taille
//! exacte pour l'Original) : un fichier supprimé/tronqué hors app passe en
//! `error` et n'est JAMAIS présenté comme lisible. La progression locale est
//! par utilisateur ; hors ligne elle alimente aussi la file de resynchro.

use super::{fsops, queue, store};
use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use std::path::Path;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalSubtitleFile {
    pub absolute_path: String,
    pub file_name: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalSource {
    pub file_id: i64,
    pub variant: String,
    /// Chemin absolu — passé tel quel à mpv (`loadfile`).
    pub absolute_path: String,
    pub subtitle_files: Vec<LocalSubtitleFile>,
    pub position_ticks: i64,
    pub played: bool,
    pub auto_delete_after_watch: bool,
    /// Méta dénormalisée (item_meta) : le lecteur reste présentable même en
    /// démarrage 100 % hors ligne, sans DTO serveur.
    pub title: Option<String>,
    pub series_name: Option<String>,
    pub runtime_ticks: Option<i64>,
    /// Numéros de saison/épisode : sous-titre « S02E04 — … » du lecteur quand
    /// aucun DTO serveur n'est disponible.
    pub index_number: Option<i64>,
    pub parent_index_number: Option<i64>,
    /// Bibliothèque de l'item (préférences de pistes hors ligne).
    pub library_id: Option<String>,
}

fn list_subtitles(root: &Path, item_id: &str) -> Vec<LocalSubtitleFile> {
    let Ok(dir) = fsops::safe_join(root, &format!("media/{item_id}/subs")) else {
        return Vec::new();
    };
    let Ok(entries) = std::fs::read_dir(&dir) else { return Vec::new() };
    let mut files: Vec<LocalSubtitleFile> = entries
        .flatten()
        .filter(|entry| entry.path().is_file())
        .filter_map(|entry| {
            let name = entry.file_name().to_string_lossy().into_owned();
            Some(LocalSubtitleFile {
                absolute_path: entry.path().to_string_lossy().into_owned(),
                file_name: name,
            })
        })
        .collect();
    files.sort_by(|a, b| a.file_name.cmp(&b.file_name));
    files
}

/// Meilleur fichier local LISIBLE pour cet utilisateur et cet item — avec
/// revérification disque. Renvoie None (et marque `error`) si le fichier a
/// disparu ou ne fait plus la taille attendue.
pub fn local_source(
    conn: &Connection,
    root: &Path,
    user_id: &str,
    item_id: &str,
    now_ms: i64,
) -> Result<Option<LocalSource>, String> {
    let Some(file) = store::complete_file_for_item(conn, user_id, item_id)? else {
        return Ok(None);
    };
    let path = fsops::safe_join(root, &file.rel_path)?;
    let metadata = match std::fs::metadata(&path) {
        Ok(m) => m,
        Err(_) => {
            queue::set_status(conn, file.id, "error", Some("missing"), now_ms)?;
            return Ok(None);
        }
    };
    if file.variant == "original" {
        if let Some(expected) = file.expected_size {
            if expected > 0 && metadata.len() as i64 != expected {
                queue::set_status(conn, file.id, "error", Some("integrity"), now_ms)?;
                return Ok(None);
            }
        }
    }

    let auto_delete: bool = conn
        .query_row(
            "SELECT auto_delete_after_watch FROM claims
             WHERE jellyfin_user_id = ?1 AND file_id = ?2",
            params![user_id, file.id],
            |row| row.get::<_, i64>(0),
        )
        .optional()
        .map_err(|e| format!("claim flag: {e}"))?
        .map(|v| v != 0)
        .unwrap_or(false);

    let state: Option<(i64, i64)> = conn
        .query_row(
            "SELECT position_ticks, played FROM playback_state
             WHERE jellyfin_user_id = ?1 AND item_id = ?2",
            params![user_id, item_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()
        .map_err(|e| format!("playback state: {e}"))?;

    type MetaTuple = (
        Option<String>, Option<String>, Option<i64>, Option<String>, Option<i64>, Option<i64>,
    );
    let meta: Option<MetaTuple> = conn
        .query_row(
            "SELECT title, series_name, runtime_ticks, library_id, index_number,
                    parent_index_number
             FROM item_meta WHERE item_id = ?1",
            params![item_id],
            |row| {
                Ok((
                    row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?,
                ))
            },
        )
        .optional()
        .map_err(|e| format!("item meta: {e}"))?;
    let (title, series_name, runtime_ticks, library_id, index_number, parent_index_number) =
        meta.unwrap_or((None, None, None, None, None, None));

    Ok(Some(LocalSource {
        file_id: file.id,
        variant: file.variant.clone(),
        absolute_path: path.to_string_lossy().into_owned(),
        subtitle_files: list_subtitles(root, item_id),
        position_ticks: state.map(|s| s.0).unwrap_or(0),
        played: state.map(|s| s.1 != 0).unwrap_or(false),
        auto_delete_after_watch: auto_delete,
        title,
        series_name,
        runtime_ticks,
        index_number,
        parent_index_number,
        library_id,
    }))
}

/// Progression locale (par utilisateur). `queue_for_sync` = lecture HORS
/// LIGNE : l'événement rejoint la file de resynchronisation (dédupliquée au
/// drain — dernier état par item).
pub fn set_playback_state(
    conn: &Connection,
    user_id: &str,
    item_id: &str,
    position_ticks: i64,
    played: bool,
    queue_for_sync: bool,
    now_ms: i64,
) -> Result<(), String> {
    conn.execute(
        "INSERT INTO playback_state (jellyfin_user_id, item_id, position_ticks, played, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(jellyfin_user_id, item_id) DO UPDATE SET
           position_ticks = excluded.position_ticks,
           played = MAX(playback_state.played, excluded.played),
           updated_at = excluded.updated_at",
        params![user_id, item_id, position_ticks, played as i64, now_ms],
    )
    .map_err(|e| format!("set playback: {e}"))?;
    if queue_for_sync {
        conn.execute(
            "INSERT INTO report_queue (jellyfin_user_id, item_id, position_ticks, played, occurred_at_utc)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![user_id, item_id, position_ticks, played as i64, now_ms],
        )
        .map_err(|e| format!("queue report: {e}"))?;
    }
    Ok(())
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PendingReport {
    pub id: i64,
    pub item_id: String,
    pub position_ticks: i64,
    pub played: bool,
    pub occurred_at_utc: i64,
}

/// Rapports à resynchroniser — DÉDUPLIQUÉS : un seul (le plus récent) par
/// item. Les entrées plus anciennes du même item seront marquées synced en
/// même temps que lui (`mark_item_synced`).
pub fn pending_reports(conn: &Connection, user_id: &str) -> Result<Vec<PendingReport>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, item_id, position_ticks, played, occurred_at_utc
             FROM report_queue AS rq
             WHERE synced = 0 AND jellyfin_user_id = ?1
               AND id = (SELECT MAX(id) FROM report_queue
                         WHERE jellyfin_user_id = rq.jellyfin_user_id
                           AND item_id = rq.item_id AND synced = 0)
             ORDER BY id ASC",
        )
        .map_err(|e| format!("prepare pending: {e}"))?;
    let rows = stmt
        .query_map(params![user_id], |row| {
            Ok(PendingReport {
                id: row.get(0)?,
                item_id: row.get(1)?,
                position_ticks: row.get(2)?,
                played: row.get::<_, i64>(3)? != 0,
                occurred_at_utc: row.get(4)?,
            })
        })
        .map_err(|e| format!("query pending: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("collect pending: {e}"))?;
    Ok(rows)
}

/// Marque synchronisés TOUS les rapports d'un item jusqu'à `up_to_id` inclus.
pub fn mark_item_synced(
    conn: &Connection,
    user_id: &str,
    item_id: &str,
    up_to_id: i64,
) -> Result<(), String> {
    conn.execute(
        "UPDATE report_queue SET synced = 1
         WHERE jellyfin_user_id = ?1 AND item_id = ?2 AND id <= ?3",
        params![user_id, item_id, up_to_id],
    )
    .map_err(|e| format!("mark synced: {e}"))?;
    Ok(())
}

#[cfg(test)]
#[path = "playback_tests.rs"]
mod tests;
