//! Tests de `store.rs` — dédup par claims, suppression physique au dernier
//! claim, cloisonnement par utilisateur, résolution Original > Allégé.

use super::*;
use crate::downloads::db;

fn write_media(root: &Path, rel: &str) {
    let path = root.join(rel);
    std::fs::create_dir_all(path.parent().unwrap()).unwrap();
    std::fs::write(&path, b"data").unwrap();
}

#[test]
fn dedup_deux_comptes_un_seul_fichier() {
    let mut conn = db::open_in_memory();
    let a = claim_or_create_file(
        &mut conn, "userA", "item1", "ms1", "original", None,
        "media/item1/original-ms1.mkv", Some(4), false, 1_000,
    )
    .unwrap();
    assert!(a.created);
    let b = claim_or_create_file(
        &mut conn, "userB", "item1", "ms1", "original", None,
        "media/item1/original-ms1.mkv", Some(4), false, 2_000,
    )
    .unwrap();
    assert!(!b.created);
    assert_eq!(a.file_id, b.file_id);
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM files", [], |r| r.get(0))
        .unwrap();
    assert_eq!(count, 1);
}

#[test]
fn suppression_dernier_claim_efface_le_fichier_physique() {
    let tmp = tempfile::tempdir().unwrap();
    let root = tmp.path();
    fsops::ensure_layout(root).unwrap();
    let rel = "media/item1/original-ms1.mkv";
    write_media(root, rel);

    let mut conn = db::open_in_memory();
    let o = claim_or_create_file(
        &mut conn, "userA", "item1", "ms1", "original", None, rel, Some(4), false, 1_000,
    )
    .unwrap();
    claim_or_create_file(
        &mut conn, "userB", "item1", "ms1", "original", None, rel, Some(4), false, 1_000,
    )
    .unwrap();

    // userA supprime : userB référence encore → fichier conservé.
    let d1 = delete_claim(&mut conn, root, "userA", o.file_id).unwrap();
    assert!(!d1.file_deleted);
    assert!(root.join(rel).exists());

    // Dernier claim → suppression physique + méta orpheline purgée.
    let d2 = delete_claim(&mut conn, root, "userB", o.file_id).unwrap();
    assert!(d2.file_deleted);
    assert!(d2.meta_deleted);
    assert!(!root.join(rel).exists());
}

#[test]
fn listes_cloisonnees_par_utilisateur() {
    use crate::downloads::listing;
    let mut conn = db::open_in_memory();
    claim_or_create_file(
        &mut conn, "userA", "item1", "ms1", "original", None,
        "media/item1/original-ms1.mkv", None, false, 1_000,
    )
    .unwrap();
    claim_or_create_file(
        &mut conn, "userB", "item2", "ms2", "light", Some("p720"),
        "media/item2/light-ms2-p720.mp4", None, false, 1_000,
    )
    .unwrap();
    let a = listing::list_for_user(&conn, "userA").unwrap();
    let b = listing::list_for_user(&conn, "userB").unwrap();
    assert_eq!(a.len(), 1);
    assert_eq!(b.len(), 1);
    assert_eq!(a[0].file.item_id, "item1");
    assert_eq!(b[0].file.item_id, "item2");
    assert!(listing::list_for_user(&conn, "userC").unwrap().is_empty());
}

#[test]
fn resolution_prefere_l_original_complet() {
    let mut conn = db::open_in_memory();
    let light = claim_or_create_file(
        &mut conn, "u", "item1", "ms1", "light", Some("p720"),
        "media/item1/light-ms1-p720.mp4", None, false, 1_000,
    )
    .unwrap();
    let original = claim_or_create_file(
        &mut conn, "u", "item1", "ms1", "original", None,
        "media/item1/original-ms1.mkv", None, false, 1_000,
    )
    .unwrap();
    conn.execute("UPDATE files SET status = 'complete'", []).unwrap();
    let best = complete_file_for_item(&conn, "u", "item1").unwrap().unwrap();
    assert_eq!(best.id, original.file_id);
    assert_ne!(best.id, light.file_id);
    // L'autre compte ne voit rien.
    assert!(complete_file_for_item(&conn, "autre", "item1").unwrap().is_none());
}

#[test]
fn reactivation_d_un_fichier_annule() {
    let mut conn = db::open_in_memory();
    let o = claim_or_create_file(
        &mut conn, "u", "item1", "ms1", "original", None,
        "media/item1/original-ms1.mkv", None, false, 1_000,
    )
    .unwrap();
    conn.execute(
        "UPDATE files SET status = 'canceled', bytes_done = 42",
        [],
    )
    .unwrap();
    let again = claim_or_create_file(
        &mut conn, "u", "item1", "ms1", "original", None,
        "media/item1/original-ms1.mkv", None, false, 2_000,
    )
    .unwrap();
    assert_eq!(again.file_id, o.file_id);
    let (status, bytes): (String, i64) = conn
        .query_row("SELECT status, bytes_done FROM files WHERE id = ?1",
            params![o.file_id], |r| Ok((r.get(0)?, r.get(1)?)))
        .unwrap();
    assert_eq!(status, "queued");
    assert_eq!(bytes, 0);
}
