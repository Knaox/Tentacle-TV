//! Protocole `tentacle-local` — sert affiches, méta JSON et sous-titres
//! locaux à la webview, confinés à `media/` et `meta/` sous la racine de
//! stockage. Formes d'URL (résolues côté JS, `localResourceUrl`) :
//!   macOS : tentacle-local://localhost/meta/<itemId>/primary.jpg
//!   Windows/Linux : http://tentacle-local.localhost/meta/<itemId>/primary.jpg
//! Le lecteur mpv N'utilise PAS ce protocole (rendu natif, chemins directs).

use super::fsops;
use tauri::http::{Request, Response};
use tauri::AppHandle;

pub fn handle(app: &AppHandle, request: Request<Vec<u8>>) -> Response<Vec<u8>> {
    match serve(app, request.uri().path()) {
        Ok((bytes, mime)) => Response::builder()
            .status(200)
            .header("content-type", mime)
            // Ressources immuables par construction (GUID + noms fixes,
            // réécrites uniquement lors d'un re-téléchargement complet).
            .header("cache-control", "public, max-age=86400")
            .header("access-control-allow-origin", "*")
            .body(bytes)
            .unwrap_or_else(|_| plain_status(500)),
        Err(status) => plain_status(status),
    }
}

fn serve(app: &AppHandle, uri_path: &str) -> Result<(Vec<u8>, &'static str), u16> {
    let rel = uri_path.trim_start_matches('/');
    let mime = mime_for(rel).ok_or(404u16)?;
    let root = fsops::resolve_root(app).map_err(|_| 500u16)?;
    let path = fsops::safe_join(&root, rel).map_err(|_| 404u16)?;
    let bytes = std::fs::read(&path).map_err(|_| 404u16)?;
    Ok((bytes, mime))
}

/// Extensions servies — liste FERMÉE (tout le reste est 404, y compris les
/// fichiers média eux-mêmes : ils ne transitent jamais par la webview).
fn mime_for(rel: &str) -> Option<&'static str> {
    let ext = rel.rsplit('.').next()?;
    match ext.to_ascii_lowercase().as_str() {
        "jpg" | "jpeg" => Some("image/jpeg"),
        "png" => Some("image/png"),
        "webp" => Some("image/webp"),
        "json" => Some("application/json"),
        "srt" | "vtt" | "ass" | "ssa" => Some("text/plain; charset=utf-8"),
        _ => None,
    }
}

fn plain_status(status: u16) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .body(Vec::new())
        .expect("static response")
}
