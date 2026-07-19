//! Opérations transactionnelles sur `files` + `claims` — la déduplication par
//! compteur de références. Un même média demandé par deux comptes = UN fichier
//! (`files`) + un claim par compte. La suppression du dernier claim entraîne
//! la suppression PHYSIQUE (fichier + .part), et si plus aucun fichier ne
//! référence l'item, la méta locale de l'item part aussi.
//! Tests : `store_tests.rs` (limite de 300 lignes par fichier).

use super::fsops;
use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use std::path::Path;

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FileRow {
    pub id: i64,
    pub item_id: String,
    pub media_source_id: String,
    pub variant: String,
    pub preset: Option<String>,
    pub rel_path: String,
    pub expected_size: Option<i64>,
    pub bytes_done: i64,
    pub status: String,
    pub error_code: Option<String>,
    pub audio_stream_index: Option<i64>,
    pub burn_subtitle_index: Option<i64>,
    /// Liste JSON des sous-titres texte à récupérer en side-cars (subs.rs).
    #[serde(skip_serializing)]
    pub subtitles_json: Option<String>,
}

pub(super) fn map_file_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<FileRow> {
    Ok(FileRow {
        id: row.get(0)?,
        item_id: row.get(1)?,
        media_source_id: row.get(2)?,
        variant: row.get(3)?,
        preset: row.get(4)?,
        rel_path: row.get(5)?,
        expected_size: row.get(6)?,
        bytes_done: row.get(7)?,
        status: row.get(8)?,
        error_code: row.get(9)?,
        audio_stream_index: row.get(10)?,
        burn_subtitle_index: row.get(11)?,
        subtitles_json: row.get(12)?,
    })
}

/// Colonnes préfixées `files.` — les requêtes joignent `claims`.
pub(super) const FILE_COLS: &str =
    "files.id, files.item_id, files.media_source_id, files.variant, files.preset, \
     files.rel_path, files.expected_size, files.bytes_done, files.status, files.error_code, \
     files.audio_stream_index, files.burn_subtitle_index, files.subtitles_json";

/// Paramètres du mode Allégé + side-cars, posés à l'enqueue (idempotent).
pub fn set_light_params(
    conn: &Connection,
    file_id: i64,
    audio_stream_index: Option<i64>,
    burn_subtitle_index: Option<i64>,
    subtitles_json: Option<&str>,
) -> Result<(), String> {
    conn.execute(
        "UPDATE files SET audio_stream_index = ?2, burn_subtitle_index = ?3,
         subtitles_json = ?4 WHERE id = ?1",
        params![file_id, audio_stream_index, burn_subtitle_index, subtitles_json],
    )
    .map_err(|e| format!("set light params: {e}"))?;
    Ok(())
}

/// Fichier existant pour une identité (item, source, variante, preset) ?
pub fn find_file(
    conn: &Connection,
    item_id: &str,
    media_source_id: &str,
    variant: &str,
    preset: Option<&str>,
) -> Result<Option<(i64, String)>, String> {
    conn.query_row(
        "SELECT id, status FROM files
         WHERE item_id = ?1 AND media_source_id = ?2 AND variant = ?3
           AND COALESCE(preset, '') = COALESCE(?4, '')",
        params![item_id, media_source_id, variant, preset],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )
    .optional()
    .map_err(|e| format!("find file: {e}"))
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ClaimOutcome {
    pub file_id: i64,
    /// true si un nouveau transfert a été créé, false si on s'est accroché à
    /// un fichier existant (dédup).
    pub created: bool,
}

/// Attache un claim au fichier correspondant (dédup) ou crée le fichier en
/// file d'attente. Un fichier `canceled` est réactivé en `queued`.
#[allow(clippy::too_many_arguments)]
pub fn claim_or_create_file(
    conn: &mut Connection,
    user_id: &str,
    item_id: &str,
    media_source_id: &str,
    variant: &str,
    preset: Option<&str>,
    rel_path: &str,
    expected_size: Option<i64>,
    auto_delete_after_watch: bool,
    now_ms: i64,
) -> Result<ClaimOutcome, String> {
    let tx = conn.transaction().map_err(|e| format!("tx: {e}"))?;
    let existing: Option<(i64, String)> = tx
        .query_row(
            "SELECT id, status FROM files
             WHERE item_id = ?1 AND media_source_id = ?2 AND variant = ?3
               AND COALESCE(preset, '') = COALESCE(?4, '')",
            params![item_id, media_source_id, variant, preset],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()
        .map_err(|e| format!("find file: {e}"))?;

    let (file_id, created) = match existing {
        Some((id, status)) => {
            if status == "canceled" {
                tx.execute(
                    "UPDATE files SET status = 'queued', bytes_done = 0, error_code = NULL,
                     paused_by_user = 0, updated_at = ?2 WHERE id = ?1",
                    params![id, now_ms],
                )
                .map_err(|e| format!("requeue file: {e}"))?;
            }
            (id, false)
        }
        None => {
            tx.execute(
                "INSERT INTO files (item_id, media_source_id, variant, preset, rel_path,
                                    expected_size, bytes_done, status, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, 'queued', ?7, ?7)",
                params![item_id, media_source_id, variant, preset, rel_path, expected_size, now_ms],
            )
            .map_err(|e| format!("insert file: {e}"))?;
            (tx.last_insert_rowid(), true)
        }
    };

    tx.execute(
        "INSERT INTO claims (jellyfin_user_id, file_id, auto_delete_after_watch, created_at)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(jellyfin_user_id, file_id) DO NOTHING",
        params![user_id, file_id, auto_delete_after_watch as i64, now_ms],
    )
    .map_err(|e| format!("insert claim: {e}"))?;

    tx.commit().map_err(|e| format!("commit: {e}"))?;
    Ok(ClaimOutcome { file_id, created })
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DeleteOutcome {
    /// true si le fichier physique a été supprimé (dernier claim).
    pub file_deleted: bool,
    /// true si la méta de l'item a aussi été purgée (plus aucun fichier).
    pub meta_deleted: bool,
}

/// Retire le claim d'un utilisateur. Dernier claim → suppression de la ligne
/// `files` en transaction, PUIS suppression physique (fichier + .part, et méta
/// d'item si orpheline) hors transaction — un échec fs n'annule pas l'index,
/// le balayage de démarrage rattrapera un éventuel orphelin disque.
pub fn delete_claim(
    conn: &mut Connection,
    root: &Path,
    user_id: &str,
    file_id: i64,
) -> Result<DeleteOutcome, String> {
    let tx = conn.transaction().map_err(|e| format!("tx: {e}"))?;
    let removed = tx
        .execute(
            "DELETE FROM claims WHERE jellyfin_user_id = ?1 AND file_id = ?2",
            params![user_id, file_id],
        )
        .map_err(|e| format!("delete claim: {e}"))?;
    if removed == 0 {
        tx.commit().map_err(|e| format!("commit: {e}"))?;
        return Ok(DeleteOutcome { file_deleted: false, meta_deleted: false });
    }
    let remaining: i64 = tx
        .query_row(
            "SELECT COUNT(*) FROM claims WHERE file_id = ?1",
            params![file_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("count claims: {e}"))?;
    if remaining > 0 {
        tx.commit().map_err(|e| format!("commit: {e}"))?;
        return Ok(DeleteOutcome { file_deleted: false, meta_deleted: false });
    }

    let (item_id, rel_path): (String, String) = tx
        .query_row(
            "SELECT item_id, rel_path FROM files WHERE id = ?1",
            params![file_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| format!("read file: {e}"))?;
    tx.execute("DELETE FROM files WHERE id = ?1", params![file_id])
        .map_err(|e| format!("delete file row: {e}"))?;
    let siblings: i64 = tx
        .query_row(
            "SELECT COUNT(*) FROM files WHERE item_id = ?1",
            params![item_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("count siblings: {e}"))?;
    let meta_orphan = siblings == 0;
    if meta_orphan {
        tx.execute("DELETE FROM item_meta WHERE item_id = ?1", params![item_id])
            .map_err(|e| format!("delete item_meta: {e}"))?;
    }
    tx.commit().map_err(|e| format!("commit: {e}"))?;

    fsops::remove_media_file(root, &rel_path)?;
    if meta_orphan {
        fsops::remove_item_meta_dir(root, &item_id)?;
    }
    Ok(DeleteOutcome { file_deleted: true, meta_deleted: meta_orphan })
}

/// Meilleur fichier COMPLET revendiqué par l'utilisateur pour un item —
/// Original prioritaire sur Allégé (résolution de source à la lecture).
pub fn complete_file_for_item(
    conn: &Connection,
    user_id: &str,
    item_id: &str,
) -> Result<Option<FileRow>, String> {
    conn.query_row(
        &format!(
            "SELECT {FILE_COLS} FROM files
             JOIN claims ON claims.file_id = files.id
             WHERE claims.jellyfin_user_id = ?1 AND files.item_id = ?2
               AND files.status = 'complete'
             ORDER BY CASE files.variant WHEN 'original' THEN 0 ELSE 1 END
             LIMIT 1"
        ),
        params![user_id, item_id],
        map_file_row,
    )
    .optional()
    .map_err(|e| format!("file for item: {e}"))
}

/// Octets occupés sur le disque par TOUS les fichiers (partiels compris).
pub fn disk_usage(conn: &Connection) -> Result<i64, String> {
    conn.query_row(
        "SELECT COALESCE(SUM(bytes_done), 0) FROM files",
        [],
        |row| row.get(0),
    )
    .map_err(|e| format!("disk usage: {e}"))
}

#[cfg(test)]
#[path = "store_tests.rs"]
mod tests;
