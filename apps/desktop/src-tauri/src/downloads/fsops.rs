//! Racine de stockage, arborescence, espace disque et chemins sûrs.
//!
//! La racine par défaut est `<app_data_dir>/downloads` (par OS, via Tauri).
//! Elle est configurable (hors build Mac App Store — décision v1, gating côté
//! UI) via `settings.storage_root` ; le changement est REFUSÉ tant que des
//! téléchargements existent (pas de migration automatique en v1).
//!
//! Tous les chemins stockés en base sont RELATIFS à la racine et confinés à
//! `media/` ou `meta/` — `safe_join` rejette toute traversée.

use super::db;
use std::path::{Component, Path, PathBuf};
use std::sync::RwLock;
use tauri::AppHandle;

pub const STORAGE_ROOT_KEY: &str = "storage_root";
/// Marge de sécurité : jamais moins de 2 Gio laissés libres sur le disque.
pub const CAPACITY_MARGIN_BYTES: u64 = 2 * 1024 * 1024 * 1024;

/// Cache mémoire de la racine résolue (une seule lecture SQLite par session).
/// Invalidé par `set_root`.
#[derive(Default)]
pub struct RootCache(pub RwLock<Option<PathBuf>>);

/// Autorise la racine dans la portée du protocole ASSET de Tauri : la webview
/// lit affiches et méta locales via `convertFileSrc` (chemin éprouvé dev+prod
/// sur les 3 OS). Idempotent, best-effort.
pub fn allow_asset_scope(app: &AppHandle, root: &Path) {
    use tauri::Manager;
    let _ = app.asset_protocol_scope().allow_directory(root, true);
}

pub fn default_root(app: &AppHandle) -> Result<PathBuf, String> {
    use tauri::Manager;
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir: {e}"))?;
    Ok(dir.join("downloads"))
}

/// Crée `media/` et `meta/` sous la racine.
pub fn ensure_layout(root: &Path) -> Result<(), String> {
    for sub in ["media", "meta"] {
        std::fs::create_dir_all(root.join(sub))
            .map_err(|e| format!("create {sub}/: {e}"))?;
    }
    Ok(())
}

/// Racine effective : cache mémoire → settings → défaut. Crée l'arborescence.
pub fn resolve_root(app: &AppHandle) -> Result<PathBuf, String> {
    use tauri::Manager;
    if let Some(cache) = app.try_state::<RootCache>() {
        if let Ok(guard) = cache.0.read() {
            if let Some(path) = guard.clone() {
                return Ok(path);
            }
        }
    }
    let conn = db::open(&db::db_path(app)?)?;
    let root = match db::setting_get(&conn, STORAGE_ROOT_KEY)? {
        Some(saved) => PathBuf::from(saved),
        None => default_root(app)?,
    };
    ensure_layout(&root)?;
    allow_asset_scope(app, &root);
    if let Some(cache) = app.try_state::<RootCache>() {
        if let Ok(mut guard) = cache.0.write() {
            *guard = Some(root.clone());
        }
    }
    Ok(root)
}

/// Change la racine. Codes d'erreur stables (consommés par l'UI) :
/// `root-not-empty` (des téléchargements existent), `root-not-writable`.
pub fn set_root(
    conn: &rusqlite::Connection,
    cache: &RootCache,
    new_root: &Path,
) -> Result<PathBuf, String> {
    let files_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM files", [], |row| row.get(0))
        .map_err(|e| format!("count files: {e}"))?;
    if files_count > 0 {
        return Err("root-not-empty".into());
    }
    std::fs::create_dir_all(new_root).map_err(|_| "root-not-writable".to_string())?;
    ensure_layout(new_root).map_err(|_| "root-not-writable".to_string())?;
    let probe = new_root.join(".tentacle-write-probe");
    std::fs::write(&probe, b"ok").map_err(|_| "root-not-writable".to_string())?;
    let _ = std::fs::remove_file(&probe);
    db::setting_set(conn, STORAGE_ROOT_KEY, &new_root.to_string_lossy())?;
    if let Ok(mut guard) = cache.0.write() {
        *guard = Some(new_root.to_path_buf());
    }
    Ok(new_root.to_path_buf())
}

/// Espace libre du volume portant la racine.
pub fn free_space(root: &Path) -> Result<u64, String> {
    fs4::available_space(root).map_err(|e| format!("available_space: {e}"))
}

/// Assez de place pour `needed` octets en respectant la marge ?
pub fn has_capacity(needed: u64, free: u64) -> bool {
    free > needed.saturating_add(CAPACITY_MARGIN_BYTES)
}

/// Joint un chemin RELATIF sous la racine en refusant toute traversée :
/// uniquement des composants normaux, préfixe `media/` ou `meta/`.
pub fn safe_join(root: &Path, rel: &str) -> Result<PathBuf, String> {
    if rel.is_empty() || rel.contains('%') {
        return Err("invalid-path".into());
    }
    let rel_path = Path::new(rel);
    let mut components = rel_path.components();
    match components.next() {
        Some(Component::Normal(first)) if first == "media" || first == "meta" => {}
        _ => return Err("invalid-path".into()),
    }
    if !components.all(|c| matches!(c, Component::Normal(_))) {
        return Err("invalid-path".into());
    }
    Ok(root.join(rel_path))
}

/// Supprime le fichier final ET son éventuel `.part` (best-effort sur ce
/// dernier). Un fichier déjà absent n'est pas une erreur.
pub fn remove_media_file(root: &Path, rel: &str) -> Result<(), String> {
    let path = safe_join(root, rel)?;
    match std::fs::remove_file(&path) {
        Ok(()) => {}
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
        Err(e) => return Err(format!("remove {rel}: {e}")),
    }
    let mut part = path.into_os_string();
    part.push(".part");
    let _ = std::fs::remove_file(PathBuf::from(part));
    Ok(())
}

/// Supprime récursivement le dossier de méta d'un item (best-effort).
pub fn remove_item_meta_dir(root: &Path, item_id: &str) -> Result<(), String> {
    let dir = safe_join(root, &format!("meta/{item_id}"))?;
    match std::fs::remove_dir_all(&dir) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("remove meta {item_id}: {e}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn safe_join_refuse_les_traversees() {
        let root = Path::new("/tmp/root");
        assert!(safe_join(root, "media/abc/file.mkv").is_ok());
        assert!(safe_join(root, "meta/abc/primary.jpg").is_ok());
        assert!(safe_join(root, "../evil").is_err());
        assert!(safe_join(root, "media/../../evil").is_err());
        assert!(safe_join(root, "/etc/passwd").is_err());
        assert!(safe_join(root, "autre/x").is_err());
        assert!(safe_join(root, "media/%2e%2e/x").is_err());
        assert!(safe_join(root, "").is_err());
    }

    #[test]
    fn has_capacity_respecte_la_marge() {
        let gio: u64 = 1024 * 1024 * 1024;
        assert!(has_capacity(gio, 4 * gio));
        assert!(!has_capacity(gio, 3 * gio)); // 1 Gio demandé + 2 de marge = 3, il faut STRICTEMENT plus
        assert!(!has_capacity(10 * gio, 5 * gio));
        assert!(!has_capacity(u64::MAX, u64::MAX)); // saturation sans panique
    }
}
