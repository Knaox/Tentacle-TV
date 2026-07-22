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
    /// Délai après visionnage avant suppression (minutes, 0 = immédiat).
    pub auto_delete_delay_minutes: i64,
    /// Échéance de suppression (epoch SECONDES) — posée quand l'item est vu.
    pub delete_scheduled_at: Option<i64>,
}

const LIST_EXTRA_COLS: &str =
    "item_meta.title, item_meta.series_name, item_meta.kind, item_meta.series_id, \
     item_meta.season_id, item_meta.index_number, item_meta.parent_index_number, \
     item_meta.runtime_ticks, claims.auto_delete_after_watch, \
     claims.auto_delete_delay_minutes, claims.delete_scheduled_at";

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
        auto_delete_delay_minutes: row.get(22)?,
        delete_scheduled_at: row.get(23)?,
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

/// Bascule + délai d'auto-suppression d'un claim. OFF ⇒ tout est remis à
/// zéro (échéance comprise). ON avec échéance existante et délai changé ⇒
/// REBASE : l'échéance reste ancrée au moment du visionnage d'origine. ON sur
/// un item DÉJÀ vu sans échéance ⇒ planification depuis MAINTENANT (jamais de
/// suppression surprise en activant l'option a posteriori).
pub fn set_auto_delete(
    conn: &Connection,
    user_id: &str,
    file_id: i64,
    enabled: bool,
    delay_minutes: i64,
    now_ms: i64,
) -> Result<(), String> {
    if !enabled {
        conn.execute(
            "UPDATE claims SET auto_delete_after_watch = 0, auto_delete_delay_minutes = 0,
                    delete_scheduled_at = NULL
             WHERE jellyfin_user_id = ?1 AND file_id = ?2",
            params![user_id, file_id],
        )
        .map_err(|e| format!("set auto delete off: {e}"))?;
        return Ok(());
    }

    let delay = delay_minutes.max(0);
    let current: Option<(Option<i64>, i64, String)> = conn
        .query_row(
            "SELECT c.delete_scheduled_at, c.auto_delete_delay_minutes, f.item_id
             FROM claims c JOIN files f ON f.id = c.file_id
             WHERE c.jellyfin_user_id = ?1 AND c.file_id = ?2",
            params![user_id, file_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .optional()
        .map_err(|e| format!("read claim: {e}"))?;
    let Some((scheduled, old_delay, item_id)) = current else {
        return Ok(());
    };

    let new_scheduled: Option<i64> = match scheduled {
        Some(at) => Some(at - old_delay * 60 + delay * 60),
        None => {
            let played: bool = conn
                .query_row(
                    "SELECT played FROM playback_state
                     WHERE jellyfin_user_id = ?1 AND item_id = ?2",
                    params![user_id, item_id],
                    |row| row.get::<_, i64>(0),
                )
                .optional()
                .map_err(|e| format!("read played: {e}"))?
                .map(|v| v != 0)
                .unwrap_or(false);
            if played { Some(now_ms / 1000 + delay * 60) } else { None }
        }
    };

    conn.execute(
        "UPDATE claims SET auto_delete_after_watch = 1, auto_delete_delay_minutes = ?3,
                delete_scheduled_at = ?4
         WHERE jellyfin_user_id = ?1 AND file_id = ?2",
        params![user_id, file_id, delay, new_scheduled],
    )
    .map_err(|e| format!("set auto delete: {e}"))?;
    Ok(())
}
