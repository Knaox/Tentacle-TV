//! Lectures composées pour l'UI : liste des téléchargements d'un utilisateur
//! (avec titres dénormalisés), état par item (badges de fiche), et bascule
//! « supprimer après visionnage » portée par le claim (donc PAR utilisateur).

use super::store::{map_file_row, FileRow, FILE_COLS};
use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadListEntry {
    #[serde(flatten)]
    pub file: FileRow,
    pub title: Option<String>,
    pub series_name: Option<String>,
    pub kind: Option<String>,
    pub series_id: Option<String>,
    pub season_id: Option<String>,
    /// Numéro d'épisode / de saison : tri et regroupement du catalogue local.
    pub index_number: Option<i64>,
    pub parent_index_number: Option<i64>,
    /// Durée (affichée sur les vignettes d'épisode).
    pub runtime_ticks: Option<i64>,
    pub auto_delete_after_watch: bool,
}

const LIST_EXTRA_COLS: &str =
    "item_meta.title, item_meta.series_name, item_meta.kind, item_meta.series_id, \
     item_meta.season_id, item_meta.index_number, item_meta.parent_index_number, \
     item_meta.runtime_ticks, claims.auto_delete_after_watch";

fn map_entry(row: &rusqlite::Row<'_>) -> rusqlite::Result<DownloadListEntry> {
    let file = map_file_row(row)?;
    // FILE_COLS occupe les indices 0..=12 — les extras démarrent à 13.
    Ok(DownloadListEntry {
        file,
        title: row.get(13)?,
        series_name: row.get(14)?,
        kind: row.get(15)?,
        series_id: row.get(16)?,
        season_id: row.get(17)?,
        index_number: row.get(18)?,
        parent_index_number: row.get(19)?,
        runtime_ticks: row.get(20)?,
        auto_delete_after_watch: row.get::<_, i64>(21)? != 0,
    })
}

pub fn list_for_user(conn: &Connection, user_id: &str) -> Result<Vec<DownloadListEntry>, String> {
    let mut stmt = conn
        .prepare(&format!(
            "SELECT {FILE_COLS}, {LIST_EXTRA_COLS} FROM files
             JOIN claims ON claims.file_id = files.id
             LEFT JOIN item_meta ON item_meta.item_id = files.item_id
             WHERE claims.jellyfin_user_id = ?1
             ORDER BY files.created_at DESC, files.id DESC"
        ))
        .map_err(|e| format!("prepare list: {e}"))?;
    let rows = stmt
        .query_map(params![user_id], map_entry)
        .map_err(|e| format!("query list: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("collect list: {e}"))?;
    Ok(rows)
}

/// État de téléchargement d'un item pour CE compte (badge de fiche) : le
/// fichier complet prioritaire, sinon le transfert le plus récent.
pub fn state_for_item(
    conn: &Connection,
    user_id: &str,
    item_id: &str,
) -> Result<Option<DownloadListEntry>, String> {
    conn.query_row(
        &format!(
            "SELECT {FILE_COLS}, {LIST_EXTRA_COLS} FROM files
             JOIN claims ON claims.file_id = files.id
             LEFT JOIN item_meta ON item_meta.item_id = files.item_id
             WHERE claims.jellyfin_user_id = ?1 AND files.item_id = ?2
             ORDER BY CASE files.status WHEN 'complete' THEN 0 ELSE 1 END,
                      CASE files.variant WHEN 'original' THEN 0 ELSE 1 END,
                      files.created_at DESC
             LIMIT 1"
        ),
        params![user_id, item_id],
        map_entry,
    )
    .optional()
    .map_err(|e| format!("state for item: {e}"))
}

pub fn set_auto_delete(
    conn: &Connection,
    user_id: &str,
    file_id: i64,
    enabled: bool,
) -> Result<(), String> {
    conn.execute(
        "UPDATE claims SET auto_delete_after_watch = ?3
         WHERE jellyfin_user_id = ?1 AND file_id = ?2",
        params![user_id, file_id, enabled as i64],
    )
    .map_err(|e| format!("set auto delete: {e}"))?;
    Ok(())
}
