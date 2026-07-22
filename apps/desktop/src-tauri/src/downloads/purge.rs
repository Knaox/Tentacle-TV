//! Auto-suppression DIFFÉRÉE des téléchargements vus : pose de l'échéance
//! (moment du visionnage + délai du claim) et purge des échéances passées.
//! La purge tourne au démarrage du moteur — première itération immédiate =
//! RATTRAPAGE des échéances passées pendant que l'app était fermée — puis
//! toutes les 60 s, et au démontage du lecteur (commande `downloads_purge_due`,
//! qui couvre le délai « immédiatement »). Garde anti-suppression : un claim
//! dont la lecture est active (heartbeat `playback_state` < 60 s) est sauté,
//! sauf l'item explicitement exempté (celui qui vient de se terminer).

use super::{db, fsops, store};
use rusqlite::{params, Connection, OptionalExtension};
use std::path::Path;
use tauri::{AppHandle, Emitter};

const PURGE_TICK_MS: u64 = 60_000;
/// Un heartbeat de lecture plus frais que cette fenêtre = lecture en cours.
const ACTIVE_PLAYBACK_MS: i64 = 60_000;

/// Pose l'échéance quand l'item passe « vu » — idempotent (ne touche jamais
/// une échéance déjà posée). Côté Rust (appelé par `downloads_playback_set`)
/// pour rester robuste même si l'UI meurt avant le démontage du lecteur.
pub fn schedule_on_played(
    conn: &Connection,
    user_id: &str,
    item_id: &str,
    now_ms: i64,
) -> Result<(), String> {
    conn.execute(
        "UPDATE claims SET delete_scheduled_at = ?3 + auto_delete_delay_minutes * 60
         WHERE jellyfin_user_id = ?1
           AND auto_delete_after_watch = 1
           AND delete_scheduled_at IS NULL
           AND file_id IN (SELECT id FROM files WHERE item_id = ?2)
           AND EXISTS (SELECT 1 FROM playback_state
                       WHERE jellyfin_user_id = ?1 AND item_id = ?2 AND played = 1)",
        params![user_id, item_id, now_ms / 1000],
    )
    .map_err(|e| format!("schedule on played: {e}"))?;
    Ok(())
}

struct DueClaim {
    user_id: String,
    file_id: i64,
    item_id: String,
}

/// Supprime (via `store::delete_claim`, refcount : le fichier physique ne part
/// qu'au dernier claim) tous les claims dont l'échéance est passée — TOUS
/// comptes confondus. `exempt_item` court-circuite la garde de lecture active
/// pour l'item qui vient de se terminer (délai 0 « immédiatement »).
pub fn purge_due_claims(
    conn: &mut Connection,
    root: &Path,
    now_ms: i64,
    exempt_item: Option<&str>,
) -> Result<usize, String> {
    let due: Vec<DueClaim> = {
        let mut stmt = conn
            .prepare(
                "SELECT c.jellyfin_user_id, c.file_id, f.item_id
                 FROM claims c JOIN files f ON f.id = c.file_id
                 WHERE c.auto_delete_after_watch = 1
                   AND c.delete_scheduled_at IS NOT NULL
                   AND c.delete_scheduled_at <= ?1",
            )
            .map_err(|e| format!("prepare due: {e}"))?;
        let rows = stmt
            .query_map(params![now_ms / 1000], |row| {
                Ok(DueClaim { user_id: row.get(0)?, file_id: row.get(1)?, item_id: row.get(2)? })
            })
            .map_err(|e| format!("query due: {e}"))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("collect due: {e}"))?;
        rows
    };

    let mut purged = 0usize;
    for claim in due {
        let exempt = exempt_item == Some(claim.item_id.as_str());
        if !exempt && playback_active(conn, &claim.user_id, &claim.item_id, now_ms) {
            // Re-visionnage en cours : sauté, retenté au prochain tick.
            continue;
        }
        if store::delete_claim(conn, root, &claim.user_id, claim.file_id).is_ok() {
            purged += 1;
        }
    }
    Ok(purged)
}

fn playback_active(conn: &Connection, user_id: &str, item_id: &str, now_ms: i64) -> bool {
    conn.query_row(
        "SELECT updated_at FROM playback_state
         WHERE jellyfin_user_id = ?1 AND item_id = ?2",
        params![user_id, item_id],
        |row| row.get::<_, i64>(0),
    )
    .optional()
    .ok()
    .flatten()
    .map(|at| now_ms - at < ACTIVE_PLAYBACK_MS)
    .unwrap_or(false)
}

/// Boucle de purge périodique, lancée au démarrage du moteur. `Once` : un seul
/// thread par process, même si le moteur redémarre (reconnexions).
static SPAWNED: std::sync::Once = std::sync::Once::new();

pub fn spawn_periodic(app: AppHandle) {
    SPAWNED.call_once(move || {
        std::thread::spawn(move || loop {
            let purged = run_once(&app);
            if purged > 0 {
                let _ = app.emit(super::engine::EVENT_CHANGED, ());
            }
            std::thread::sleep(std::time::Duration::from_millis(PURGE_TICK_MS));
        });
    });
}

fn run_once(app: &AppHandle) -> usize {
    let Ok(db_path) = db::db_path(app) else { return 0 };
    let Ok(mut conn) = db::open(&db_path) else { return 0 };
    let Ok(root) = fsops::resolve_root(app) else { return 0 };
    purge_due_claims(&mut conn, &root, now_ms(), None).unwrap_or(0)
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}
