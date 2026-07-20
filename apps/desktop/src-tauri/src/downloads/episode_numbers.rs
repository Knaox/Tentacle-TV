//! Numéros de saison/épisode dénormalisés dans `item_meta` (schéma v5).
//!
//! Le catalogue hors ligne regroupe les épisodes par saison et les trie par
//! numéro : relire N `item.json` à chaque rendu serait absurde, ces deux
//! entiers vivent donc en base. Ils sont posés à l'enqueue (DTO en main), puis
//! confirmés par le snapshot. Pour les téléchargements ANTÉRIEURS au schéma v5,
//! `backfill` les récupère depuis les `item.json` déjà présents sur le disque —
//! sans réseau, donc opérant même au démarrage 100 % hors ligne.

use super::fsops;
use rusqlite::{params, Connection};
use std::path::Path;

/// `IndexNumber` / `ParentIndexNumber` d'un DTO Jellyfin brut.
fn parse(item_json: &[u8]) -> (Option<i64>, Option<i64>) {
    let Ok(dto) = serde_json::from_slice::<serde_json::Value>(item_json) else {
        return (None, None);
    };
    let read = |key: &str| dto.get(key).and_then(serde_json::Value::as_i64);
    (read("IndexNumber"), read("ParentIndexNumber"))
}

/// Renseigne les numéros depuis un snapshot en mémoire. Faux si le DTO n'en
/// porte pas (un film n'a pas de numéro d'épisode) ou si le JSON est illisible.
pub fn apply(conn: &Connection, item_id: &str, item_json: &[u8]) -> bool {
    let (index, parent) = parse(item_json);
    if index.is_none() && parent.is_none() {
        return false;
    }
    conn.execute(
        "UPDATE item_meta
            SET index_number = COALESCE(?2, index_number),
                parent_index_number = COALESCE(?3, parent_index_number)
          WHERE item_id = ?1",
        params![item_id, index, parent],
    )
    .is_ok()
}

/// Rattrapage hors ligne : épisodes aux numéros manquants → lecture de leur
/// `item.json` sur le disque. Idempotent (ne cible que les NULL). Retourne le
/// nombre d'items complétés.
pub fn backfill(conn: &Connection, root: &Path) -> usize {
    let Ok(mut stmt) = conn.prepare(
        "SELECT item_id FROM item_meta
          WHERE kind = 'episode' AND (index_number IS NULL OR parent_index_number IS NULL)",
    ) else {
        return 0;
    };
    let Ok(rows) = stmt.query_map([], |row| row.get::<_, String>(0)) else {
        return 0;
    };
    let ids: Vec<String> = rows.flatten().collect();
    let mut filled = 0;
    for item_id in ids {
        let Ok(path) = fsops::safe_join(root, &format!("meta/{item_id}/item.json")) else {
            continue;
        };
        let Ok(bytes) = std::fs::read(&path) else { continue };
        if apply(conn, &item_id, &bytes) {
            filled += 1;
        }
    }
    filled
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::downloads::db;
    use crate::downloads::meta::{upsert_item_meta, MetaSpec};

    fn spec(item_id: &str, kind: &str) -> MetaSpec {
        MetaSpec {
            item_id: item_id.into(),
            kind: kind.into(),
            series_id: Some("serie1".into()),
            season_id: Some("saison1".into()),
            library_id: None,
            runtime_ticks: None,
            title: Some("Titre".into()),
            series_name: Some("Série".into()),
            index_number: None,
            parent_index_number: None,
        }
    }

    fn numbers(conn: &Connection, item_id: &str) -> (Option<i64>, Option<i64>) {
        conn.query_row(
            "SELECT index_number, parent_index_number FROM item_meta WHERE item_id = ?1",
            params![item_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap()
    }

    fn write_snapshot(root: &Path, item_id: &str, body: &str) {
        let dir = root.join("meta").join(item_id);
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("item.json"), body).unwrap();
    }

    #[test]
    fn backfill_lit_les_snapshots_du_disque() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path();
        fsops::ensure_layout(root).unwrap();
        let conn = db::open_in_memory();
        upsert_item_meta(&conn, &spec("ep1", "episode"), 1_000).unwrap();
        write_snapshot(root, "ep1", r#"{"IndexNumber":4,"ParentIndexNumber":2}"#);

        assert_eq!(backfill(&conn, root), 1);
        assert_eq!(numbers(&conn, "ep1"), (Some(4), Some(2)));
        // Idempotent : plus rien à rattraper au second passage.
        assert_eq!(backfill(&conn, root), 0);
    }

    #[test]
    fn snapshot_absent_ou_invalide_laisse_les_numeros_nuls() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path();
        fsops::ensure_layout(root).unwrap();
        let conn = db::open_in_memory();
        upsert_item_meta(&conn, &spec("ep-sans-json", "episode"), 1_000).unwrap();
        upsert_item_meta(&conn, &spec("ep-json-casse", "episode"), 1_000).unwrap();
        write_snapshot(root, "ep-json-casse", "{ pas du json");

        assert_eq!(backfill(&conn, root), 0);
        assert_eq!(numbers(&conn, "ep-sans-json"), (None, None));
        assert_eq!(numbers(&conn, "ep-json-casse"), (None, None));
    }

    #[test]
    fn les_films_sont_ignores() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path();
        fsops::ensure_layout(root).unwrap();
        let conn = db::open_in_memory();
        let mut film = spec("film1", "movie");
        film.series_id = None;
        film.season_id = None;
        upsert_item_meta(&conn, &film, 1_000).unwrap();
        write_snapshot(root, "film1", r#"{"Name":"Un film"}"#);

        assert_eq!(backfill(&conn, root), 0);
        assert_eq!(numbers(&conn, "film1"), (None, None));
    }

    #[test]
    fn l_enqueue_pose_les_numeros_et_le_snapshot_ne_les_ecrase_pas() {
        let conn = db::open_in_memory();
        let mut ep = spec("ep2", "episode");
        ep.index_number = Some(7);
        ep.parent_index_number = Some(3);
        upsert_item_meta(&conn, &ep, 1_000).unwrap();
        assert_eq!(numbers(&conn, "ep2"), (Some(7), Some(3)));

        // Un ré-upsert sans numéros (re-téléchargement) les conserve.
        upsert_item_meta(&conn, &spec("ep2", "episode"), 2_000).unwrap();
        assert_eq!(numbers(&conn, "ep2"), (Some(7), Some(3)));

        // Le snapshot fait autorité quand il en porte.
        assert!(apply(&conn, "ep2", br#"{"IndexNumber":8,"ParentIndexNumber":3}"#));
        assert_eq!(numbers(&conn, "ep2"), (Some(8), Some(3)));
    }
}
