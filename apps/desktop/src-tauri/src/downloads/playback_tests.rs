//! Tests de `playback.rs` — source locale (intégrité, cloisonnement),
//! progression, file de resynchronisation (dédup + marquage).

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

#[test]
fn drain_deduplique_par_item_et_marque_l_historique() {
    let conn = db::open_in_memory();
    set_playback_state(&conn, "u", "item1", 1_000, false, true, 2_000).unwrap();
    set_playback_state(&conn, "u", "item1", 9_000, true, true, 3_000).unwrap();
    set_playback_state(&conn, "u", "item2", 4_000, false, true, 4_000).unwrap();
    set_playback_state(&conn, "autre", "item1", 7_000, false, true, 5_000).unwrap();

    let pending = pending_reports(&conn, "u").unwrap();
    assert_eq!(pending.len(), 2); // un seul rapport par item, cloisonné par compte
    let item1 = pending.iter().find(|r| r.item_id == "item1").unwrap();
    assert_eq!(item1.position_ticks, 9_000); // le plus récent gagne
    assert!(item1.played);

    mark_item_synced(&conn, "u", "item1", item1.id).unwrap();
    let rest = pending_reports(&conn, "u").unwrap();
    assert_eq!(rest.len(), 1);
    assert_eq!(rest[0].item_id, "item2");
    // Le compte « autre » n'est pas touché.
    assert_eq!(pending_reports(&conn, "autre").unwrap().len(), 1);
}
