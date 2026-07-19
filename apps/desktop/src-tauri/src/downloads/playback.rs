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

    Ok(Some(LocalSource {
        file_id: file.id,
        variant: file.variant.clone(),
        absolute_path: path.to_string_lossy().into_owned(),
        subtitle_files: list_subtitles(root, item_id),
        position_ticks: state.map(|s| s.0).unwrap_or(0),
        played: state.map(|s| s.1 != 0).unwrap_or(false),
        auto_delete_after_watch: auto_delete,
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::downloads::db;
    use crate::downloads::store::claim_or_create_file;

    fn seed_complete(conn: &mut Connection, root: &Path, rel: &str, size: i64) -> i64 {
        let file_id = claim_or_create_file(
            conn, "u", "item1", "ms1", "original", None, rel, Some(size), false, 1_000,
        )
        .unwrap()
        .file_id;
        conn.execute("UPDATE files SET status = 'complete', bytes_done = ?1", params![size])
            .unwrap();
        file_id
    }

    #[test]
    fn source_locale_valide_et_progression() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path();
        fsops::ensure_layout(root).unwrap();
        let rel = "media/item1/original-ms1.mkv";
        let path = root.join(rel);
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, b"1234").unwrap();

        let mut conn = db::open_in_memory();
        seed_complete(&mut conn, root, rel, 4);
        set_playback_state(&conn, "u", "item1", 5_000, false, false, 2_000).unwrap();

        let source = local_source(&conn, root, "u", "item1", 3_000).unwrap().unwrap();
        assert!(source.absolute_path.ends_with("original-ms1.mkv"));
        assert_eq!(source.position_ticks, 5_000);
        assert!(!source.played);
        // Cloisonnement : un autre compte n'a rien.
        assert!(local_source(&conn, root, "autre", "item1", 3_000).unwrap().is_none());
    }

    #[test]
    fn fichier_tronque_hors_app_marque_erreur() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path();
        fsops::ensure_layout(root).unwrap();
        let rel = "media/item1/original-ms1.mkv";
        let path = root.join(rel);
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, b"12").unwrap(); // 2 octets au lieu de 4

        let mut conn = db::open_in_memory();
        let file_id = seed_complete(&mut conn, root, rel, 4);
        assert!(local_source(&conn, root, "u", "item1", 3_000).unwrap().is_none());
        let (status, code): (String, Option<String>) = conn
            .query_row("SELECT status, error_code FROM files WHERE id = ?1", params![file_id],
                |r| Ok((r.get(0)?, r.get(1)?)))
            .unwrap();
        assert_eq!(status, "error");
        assert_eq!(code.as_deref(), Some("integrity"));
    }

    #[test]
    fn hors_ligne_alimente_la_file_de_resynchro() {
        let conn = db::open_in_memory();
        set_playback_state(&conn, "u", "item1", 1_000, false, true, 2_000).unwrap();
        set_playback_state(&conn, "u", "item1", 9_000, true, true, 3_000).unwrap();
        let pending: i64 = conn
            .query_row("SELECT COUNT(*) FROM report_queue WHERE synced = 0", [], |r| r.get(0))
            .unwrap();
        assert_eq!(pending, 2);
        // `played` ne redescend jamais via l'upsert local.
        set_playback_state(&conn, "u", "item1", 100, false, false, 4_000).unwrap();
        let played: i64 = conn
            .query_row("SELECT played FROM playback_state WHERE item_id = 'item1'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(played, 1);
    }
}
