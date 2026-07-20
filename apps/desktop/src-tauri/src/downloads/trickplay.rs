//! Tuiles trickplay (aperçu au survol de la barre) téléchargées localement.
//!
//! Manifeste : `item.Trickplay[mediaSourceId][width]` = TrickplayInfo (requiert
//! `fields=Trickplay` sur l'item). Nombre de planches (vérifié source Jellyfin
//! v10.11) : `ceil(ThumbnailCount / (TileWidth * TileHeight))`. Les planches
//! passent par la route trickplay DÉDIÉE du backend
//! (`/api/jellyfin/items/{id}/trickplay/{width}/{index}.jpg`), enregistrées
//! sous `meta/<item>/trickplay/<width>/<index>.jpg` + un résumé `trickplay.json`.

use super::fsops;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::io::Read;
use std::path::Path;

/// Sérialisé en PascalCase pour coller au type partagé `TrickplayInfo`
/// (packages/shared) — le lecteur le consomme tel quel, sans conversion.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct TrickplayInfo {
    pub width: i64,
    pub height: i64,
    pub tile_width: i64,
    pub tile_height: i64,
    pub thumbnail_count: i64,
    pub interval: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalTrickplay {
    pub media_source_id: String,
    pub width: i64,
    pub info: TrickplayInfo,
}

fn info_from_value(v: &Value) -> Option<TrickplayInfo> {
    let get = |k: &str| v.get(k).and_then(Value::as_i64);
    Some(TrickplayInfo {
        width: get("Width")?,
        height: get("Height")?,
        tile_width: get("TileWidth").filter(|n| *n > 0)?,
        tile_height: get("TileHeight").filter(|n| *n > 0)?,
        thumbnail_count: get("ThumbnailCount").filter(|n| *n > 0)?,
        interval: get("Interval").filter(|n| *n > 0)?,
    })
}

/// Largeur préférée (320 sinon la plus proche) pour le mediaSourceId choisi.
fn pick_width(manifest: &Value, media_source_id: &str) -> Option<(String, i64, TrickplayInfo)> {
    let by_source = manifest.as_object()?;
    let (msrc, widths) = by_source
        .get_key_value(media_source_id)
        .or_else(|| by_source.iter().next())?;
    let widths = widths.as_object()?;
    let mut best: Option<(i64, TrickplayInfo)> = None;
    for (w, info_val) in widths {
        let Ok(width) = w.parse::<i64>() else { continue };
        let Some(info) = info_from_value(info_val) else { continue };
        let better = match &best {
            None => true,
            Some((bw, _)) => (width - 320).abs() < (bw - 320).abs(),
        };
        if better {
            best = Some((width, info));
        }
    }
    best.map(|(w, info)| (msrc.clone(), w, info))
}

pub fn tile_count(info: &TrickplayInfo) -> i64 {
    let per_tile = info.tile_width * info.tile_height;
    if per_tile <= 0 {
        return 0;
    }
    (info.thumbnail_count + per_tile - 1) / per_tile
}

fn fetch_tile(agent: &ureq::Agent, url: &str, token: &str) -> Option<Vec<u8>> {
    let response = agent.get(url).set("X-Emby-Token", token).call().ok()?;
    let mut bytes = Vec::new();
    response
        .into_reader()
        .take(6 * 1024 * 1024)
        .read_to_end(&mut bytes)
        .ok()?;
    if bytes.is_empty() {
        None
    } else {
        Some(bytes)
    }
}

/// Télécharge le manifeste + toutes les planches. `item_json` = octets de
/// l'item.json déjà récupéré (avec fields=Trickplay). Retourne le nombre de
/// planches enregistrées (0 si pas de trickplay). Best-effort.
pub fn download(
    agent: &ureq::Agent,
    server_url: &str,
    token: &str,
    root: &Path,
    item_id: &str,
    media_source_id: &str,
    item_json: &[u8],
) -> usize {
    let Ok(parsed) = serde_json::from_slice::<Value>(item_json) else {
        return 0;
    };
    let Some(manifest) = parsed.get("Trickplay") else { return 0 };
    if manifest.is_null() {
        return 0;
    }
    let Some((msrc, width, info)) = pick_width(manifest, media_source_id) else {
        return 0;
    };
    let count = tile_count(&info);
    if count <= 0 || count > 10_000 {
        return 0;
    }

    let dir = format!("meta/{item_id}/trickplay/{width}");
    let mut saved = 0;
    for index in 0..count {
        let rel = format!("{dir}/{index}.jpg");
        let Ok(path) = fsops::safe_join(root, &rel) else { continue };
        if path.exists() {
            saved += 1;
            continue;
        }
        let url = format!(
            "{server_url}/api/jellyfin/items/{item_id}/trickplay/{width}/{index}.jpg?mediaSourceId={msrc}"
        );
        let Some(bytes) = fetch_tile(agent, &url, token) else { continue };
        if let Some(parent) = path.parent() {
            if std::fs::create_dir_all(parent).is_err() {
                continue;
            }
        }
        if std::fs::write(&path, &bytes).is_ok() {
            saved += 1;
        }
    }

    // Résumé pour la résolution côté lecteur (meta/<item>/trickplay.json).
    if saved > 0 {
        let summary = LocalTrickplay { media_source_id: msrc, width, info };
        if let Ok(json) = serde_json::to_vec(&summary) {
            if let Ok(path) = fsops::safe_join(root, &format!("meta/{item_id}/trickplay.json")) {
                let _ = std::fs::write(path, json);
            }
        }
    }
    saved as usize
}

/// Le manifeste trickplay local est-il déjà présent ?
pub fn exists(root: &Path, item_id: &str) -> bool {
    fsops::safe_join(root, &format!("meta/{item_id}/trickplay.json"))
        .map(|p| p.exists())
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn info() -> TrickplayInfo {
        TrickplayInfo {
            width: 320, height: 180, tile_width: 10, tile_height: 10,
            thumbnail_count: 720, interval: 10_000,
        }
    }

    #[test]
    fn nombre_de_planches_arrondi_au_superieur() {
        assert_eq!(tile_count(&info()), 8); // ceil(720 / 100)
        assert_eq!(tile_count(&TrickplayInfo { thumbnail_count: 100, ..info() }), 1);
        assert_eq!(tile_count(&TrickplayInfo { thumbnail_count: 101, ..info() }), 2);
    }

    #[test]
    fn choix_de_largeur_prefere_320() {
        let manifest = serde_json::json!({
            "msrc-A": {
                "160": {"Width":160,"Height":90,"TileWidth":10,"TileHeight":10,"ThumbnailCount":720,"Interval":10000},
                "320": {"Width":320,"Height":180,"TileWidth":10,"TileHeight":10,"ThumbnailCount":720,"Interval":10000}
            }
        });
        let (msrc, width, _) = pick_width(&manifest, "msrc-A").unwrap();
        assert_eq!(msrc, "msrc-A");
        assert_eq!(width, 320);
        // mediaSourceId absent → repli sur le premier.
        assert_eq!(pick_width(&manifest, "inconnu").unwrap().0, "msrc-A");
    }

    #[test]
    fn download_sans_trickplay_renvoie_zero() {
        let tmp = tempfile::tempdir().unwrap();
        let agent = ureq::AgentBuilder::new().build();
        let n = download(&agent, "http://127.0.0.1:1", "tok", tmp.path(), "item1", "ms1", b"{}");
        assert_eq!(n, 0);
    }
}
