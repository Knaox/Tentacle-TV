//! Cache de session hors ligne — profil + droits (policy) PAR utilisateur,
//! SANS aucun secret. TTL de 30 jours GLISSANTS : chaque écriture (faite à
//! chaque contact serveur réussi côté web) repousse l'expiration. À
//! expiration, l'entrée est conservée (données non détruites) mais signalée
//! `expired` — l'UI exige alors une reconnexion en ligne.

use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;

/// 30 jours en millisecondes.
pub const SESSION_TTL_MS: i64 = 30 * 24 * 60 * 60 * 1000;

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CachedSession {
    pub profile_json: String,
    pub policy_json: Option<String>,
    pub cached_at: i64,
    pub expires_at: i64,
    pub expired: bool,
}

pub fn get(conn: &Connection, user_id: &str, now_ms: i64) -> Result<Option<CachedSession>, String> {
    conn.query_row(
        "SELECT profile_json, policy_json, cached_at, expires_at
         FROM session_cache WHERE jellyfin_user_id = ?1",
        params![user_id],
        |row| {
            let expires_at: i64 = row.get(3)?;
            Ok(CachedSession {
                profile_json: row.get(0)?,
                policy_json: row.get(1)?,
                cached_at: row.get(2)?,
                expires_at,
                expired: now_ms > expires_at,
            })
        },
    )
    .optional()
    .map_err(|e| format!("session get: {e}"))
}

/// Upsert glissant. `policy_json = None` CONSERVE la policy déjà en cache
/// (le profil et la policy sont rafraîchis par des chemins différents côté
/// web ; une écriture de profil ne doit pas effacer les droits connus).
pub fn set(
    conn: &Connection,
    user_id: &str,
    profile_json: &str,
    policy_json: Option<&str>,
    now_ms: i64,
) -> Result<(), String> {
    conn.execute(
        "INSERT INTO session_cache (jellyfin_user_id, profile_json, policy_json, cached_at, expires_at)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(jellyfin_user_id) DO UPDATE SET
           profile_json = excluded.profile_json,
           policy_json  = COALESCE(excluded.policy_json, session_cache.policy_json),
           cached_at    = excluded.cached_at,
           expires_at   = excluded.expires_at",
        params![user_id, profile_json, policy_json, now_ms, now_ms + SESSION_TTL_MS],
    )
    .map_err(|e| format!("session set: {e}"))?;
    Ok(())
}

pub fn clear(conn: &Connection, user_id: &str) -> Result<(), String> {
    conn.execute(
        "DELETE FROM session_cache WHERE jellyfin_user_id = ?1",
        params![user_id],
    )
    .map_err(|e| format!("session clear: {e}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::downloads::db;

    const USER: &str = "u-123";

    #[test]
    fn set_puis_get_frais() {
        let conn = db::open_in_memory();
        set(&conn, USER, "{\"Name\":\"a\"}", Some("{\"p\":1}"), 1_000).unwrap();
        let s = get(&conn, USER, 2_000).unwrap().unwrap();
        assert_eq!(s.profile_json, "{\"Name\":\"a\"}");
        assert_eq!(s.policy_json.as_deref(), Some("{\"p\":1}"));
        assert_eq!(s.expires_at, 1_000 + SESSION_TTL_MS);
        assert!(!s.expired);
    }

    #[test]
    fn expire_au_dela_du_ttl() {
        let conn = db::open_in_memory();
        set(&conn, USER, "{}", None, 1_000).unwrap();
        let s = get(&conn, USER, 1_000 + SESSION_TTL_MS + 1).unwrap().unwrap();
        assert!(s.expired);
    }

    #[test]
    fn ttl_glissant_repousse_l_expiration() {
        let conn = db::open_in_memory();
        set(&conn, USER, "{}", None, 1_000).unwrap();
        set(&conn, USER, "{}", None, 500_000).unwrap();
        let s = get(&conn, USER, 500_001).unwrap().unwrap();
        assert_eq!(s.expires_at, 500_000 + SESSION_TTL_MS);
        assert!(!s.expired);
    }

    #[test]
    fn ecriture_sans_policy_conserve_la_policy() {
        let conn = db::open_in_memory();
        set(&conn, USER, "{}", Some("{\"droits\":true}"), 1_000).unwrap();
        set(&conn, USER, "{\"maj\":1}", None, 2_000).unwrap();
        let s = get(&conn, USER, 3_000).unwrap().unwrap();
        assert_eq!(s.profile_json, "{\"maj\":1}");
        assert_eq!(s.policy_json.as_deref(), Some("{\"droits\":true}"));
    }

    #[test]
    fn clear_supprime_et_utilisateurs_cloisonnes() {
        let conn = db::open_in_memory();
        set(&conn, USER, "{}", None, 1_000).unwrap();
        set(&conn, "autre", "{}", None, 1_000).unwrap();
        clear(&conn, USER).unwrap();
        assert!(get(&conn, USER, 1_500).unwrap().is_none());
        assert!(get(&conn, "autre", 1_500).unwrap().is_some());
    }
}
