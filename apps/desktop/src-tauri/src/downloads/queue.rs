//! Helpers d'état de la file de téléchargement (table `files`).
//! Statuts : queued → downloading → complete | paused | error | canceled.
//! `paused_by_user` distingue une pause explicite (jamais auto-reprise) d'une
//! pause système (coupure réseau, redémarrage — reprise automatique en ligne).

use super::store::{map_file_row, FileRow, FILE_COLS};
use rusqlite::{params, Connection, OptionalExtension};

pub fn get_file(conn: &Connection, file_id: i64) -> Result<Option<FileRow>, String> {
    conn.query_row(
        &format!("SELECT {FILE_COLS} FROM files WHERE files.id = ?1"),
        params![file_id],
        map_file_row,
    )
    .optional()
    .map_err(|e| format!("get file: {e}"))
}

/// Prochain transfert à lancer (FIFO sur la création).
pub fn next_queued(conn: &Connection) -> Result<Option<FileRow>, String> {
    conn.query_row(
        &format!(
            "SELECT {FILE_COLS} FROM files
             WHERE files.status = 'queued'
             ORDER BY files.created_at ASC, files.id ASC LIMIT 1"
        ),
        [],
        map_file_row,
    )
    .optional()
    .map_err(|e| format!("next queued: {e}"))
}

pub fn set_status(
    conn: &Connection,
    file_id: i64,
    status: &str,
    error_code: Option<&str>,
    now_ms: i64,
) -> Result<(), String> {
    conn.execute(
        "UPDATE files SET status = ?2, error_code = ?3, updated_at = ?4 WHERE id = ?1",
        params![file_id, status, error_code, now_ms],
    )
    .map_err(|e| format!("set status: {e}"))?;
    Ok(())
}

pub fn set_paused_by_user(conn: &Connection, file_id: i64, by_user: bool) -> Result<(), String> {
    conn.execute(
        "UPDATE files SET paused_by_user = ?2 WHERE id = ?1",
        params![file_id, by_user as i64],
    )
    .map_err(|e| format!("set paused_by_user: {e}"))?;
    Ok(())
}

pub fn set_bytes_done(conn: &Connection, file_id: i64, bytes: i64, now_ms: i64) -> Result<(), String> {
    conn.execute(
        "UPDATE files SET bytes_done = ?2, updated_at = ?3 WHERE id = ?1",
        params![file_id, bytes, now_ms],
    )
    .map_err(|e| format!("set bytes: {e}"))?;
    Ok(())
}

/// Au démarrage du moteur : les transferts interrompus (`downloading`) et les
/// pauses SYSTÈME redeviennent `queued` ; les pauses UTILISATEUR restent.
pub fn normalize_on_engine_start(conn: &Connection, now_ms: i64) -> Result<(), String> {
    conn.execute(
        "UPDATE files SET status = 'queued', updated_at = ?1
         WHERE status = 'downloading'
            OR (status = 'paused' AND paused_by_user = 0)",
        params![now_ms],
    )
    .map_err(|e| format!("normalize on start: {e}"))?;
    Ok(())
}

/// Somme des octets restants estimés des transferts actifs/en attente —
/// entre dans le contrôle d'espace disque d'un nouvel enqueue.
pub fn pending_bytes(conn: &Connection) -> Result<i64, String> {
    conn.query_row(
        "SELECT COALESCE(SUM(MAX(COALESCE(expected_size, 0) - bytes_done, 0)), 0)
         FROM files WHERE status IN ('queued', 'downloading', 'paused')",
        [],
        |row| row.get(0),
    )
    .map_err(|e| format!("pending bytes: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::downloads::db;
    use crate::downloads::store::claim_or_create_file;

    fn seed(conn: &mut Connection, item: &str, at: i64) -> i64 {
        claim_or_create_file(
            conn, "u", item, "ms", "original", None,
            &format!("media/{item}/original-ms.mkv"), Some(100), false, at,
        )
        .unwrap()
        .file_id
    }

    #[test]
    fn fifo_et_sortie_de_file_au_lancement() {
        let mut conn = db::open_in_memory();
        let first = seed(&mut conn, "item1", 1_000);
        let second = seed(&mut conn, "item2", 2_000);
        assert_eq!(next_queued(&conn).unwrap().unwrap().id, first);
        set_status(&conn, first, "downloading", None, 3_000).unwrap();
        assert_eq!(next_queued(&conn).unwrap().unwrap().id, second);
    }

    #[test]
    fn normalisation_au_demarrage_respecte_la_pause_utilisateur() {
        let mut conn = db::open_in_memory();
        let interrupted = seed(&mut conn, "item1", 1_000);
        let system_paused = seed(&mut conn, "item2", 2_000);
        let user_paused = seed(&mut conn, "item3", 3_000);
        set_status(&conn, interrupted, "downloading", None, 4_000).unwrap();
        set_status(&conn, system_paused, "paused", None, 4_000).unwrap();
        set_status(&conn, user_paused, "paused", None, 4_000).unwrap();
        set_paused_by_user(&conn, user_paused, true).unwrap();

        normalize_on_engine_start(&conn, 5_000).unwrap();

        let status = |id: i64| -> String {
            conn.query_row("SELECT status FROM files WHERE id = ?1", params![id], |r| r.get(0))
                .unwrap()
        };
        assert_eq!(status(interrupted), "queued");
        assert_eq!(status(system_paused), "queued");
        assert_eq!(status(user_paused), "paused");
    }

    #[test]
    fn pending_bytes_soustrait_le_deja_recu() {
        let mut conn = db::open_in_memory();
        let a = seed(&mut conn, "item1", 1_000);
        seed(&mut conn, "item2", 2_000);
        set_bytes_done(&conn, a, 40, 3_000).unwrap();
        // 100-40 + 100-0 = 160
        assert_eq!(pending_bytes(&conn).unwrap(), 160);
    }
}
