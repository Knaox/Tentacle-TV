//! Serveur HTTP loopback qui sert à la webview les ressources locales
//! (affiches, méta JSON, tuiles trickplay) sous la racine des téléchargements.
//!
//! Pourquoi pas le protocole asset de Tauri : buggé/fermé « not planned » sur
//! macOS, et surtout son CSP + son resolver sont IGNORÉS en mode dev (la page
//! est alors servie depuis http://localhost:5174, pas depuis tauri://). Le
//! serveur loopback est le pattern reconnu de la communauté.
//!
//! Durcissement : bind EXPLICITE sur 127.0.0.1 (jamais 0.0.0.0), jeton
//! aléatoire vérifié à chaque requête (le port loopback est sinon ouvert à
//! tout process local), méthode GET seule, extensions en liste FERMÉE,
//! chemins confinés à la racine (safe_join — aucune traversée). 127.0.0.1 est
//! un « secure context » : pas de blocage mixed-content depuis la page.

use super::fsops;
use std::sync::{Arc, OnceLock};
use tauri::AppHandle;
use tiny_http::{Header, Response, Server};

pub struct AssetServer {
    pub port: u16,
    pub token: String,
}

static SERVER: OnceLock<AssetServer> = OnceLock::new();

fn random_token() -> String {
    let mut bytes = [0u8; 16];
    if getrandom::getrandom(&mut bytes).is_err() {
        // Repli extrêmement improbable : horodatage (le jeton reste local +
        // loopback, ce n'est pas un secret cryptographique long terme).
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        return format!("{nanos:032x}");
    }
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn mime_for(path: &str) -> Option<&'static str> {
    let ext = path.rsplit('.').next()?;
    match ext.to_ascii_lowercase().as_str() {
        "jpg" | "jpeg" => Some("image/jpeg"),
        "png" => Some("image/png"),
        "webp" => Some("image/webp"),
        "json" => Some("application/json"),
        "srt" | "vtt" | "ass" | "ssa" => Some("text/plain; charset=utf-8"),
        _ => None,
    }
}

/// (chemin relatif, jeton fourni) depuis l'URL `/<relPath>?t=<token>`.
fn parse_request(url: &str) -> (String, Option<String>) {
    let (path, query) = match url.split_once('?') {
        Some((p, q)) => (p, q),
        None => (url, ""),
    };
    let token = query.split('&').find_map(|kv| kv.strip_prefix("t=")).map(str::to_owned);
    (path.trim_start_matches('/').to_string(), token)
}

fn header(name: &str, value: &str) -> Header {
    Header::from_bytes(name.as_bytes(), value.as_bytes()).expect("header statique")
}

fn serve(app: &AppHandle, token: &str, url: &str) -> Result<(Vec<u8>, &'static str), u16> {
    let (rel, provided) = parse_request(url);
    if provided.as_deref() != Some(token) {
        return Err(403);
    }
    let mime = mime_for(&rel).ok_or(404u16)?;
    let root = fsops::resolve_root(app).map_err(|_| 500u16)?;
    let path = fsops::safe_join(&root, &rel).map_err(|_| 404u16)?;
    let bytes = std::fs::read(&path).map_err(|_| 404u16)?;
    Ok((bytes, mime))
}

/// Démarre le serveur une fois (idempotent) et renvoie (port, jeton).
pub fn ensure_started(app: &AppHandle) -> Result<&'static AssetServer, String> {
    if let Some(server) = SERVER.get() {
        return Ok(server);
    }
    let http = Server::http("127.0.0.1:0").map_err(|e| format!("bind loopback: {e}"))?;
    let port = http
        .server_addr()
        .to_ip()
        .ok_or("adresse serveur introuvable")?
        .port();
    let token = random_token();
    let server = SERVER.get_or_init(|| AssetServer { port, token });

    let app_handle = app.clone();
    let http = Arc::new(http);
    let token_for_thread = server.token.clone();
    std::thread::spawn(move || {
        for request in http.incoming_requests() {
            if request.method() != &tiny_http::Method::Get {
                let _ = request.respond(Response::empty(405));
                continue;
            }
            let url = request.url().to_string();
            match serve(&app_handle, &token_for_thread, &url) {
                Ok((bytes, mime)) => {
                    let response = Response::from_data(bytes)
                        .with_header(header("Content-Type", mime))
                        .with_header(header("Cache-Control", "public, max-age=86400"));
                    let _ = request.respond(response);
                }
                Err(status) => {
                    let _ = request.respond(Response::empty(status as i32));
                }
            }
        }
    });
    Ok(server)
}

#[cfg(test)]
mod tests {
    use super::{mime_for, parse_request};

    #[test]
    fn parse_extrait_chemin_et_jeton() {
        assert_eq!(
            parse_request("/meta/abc/primary.jpg?t=deadbeef"),
            ("meta/abc/primary.jpg".to_string(), Some("deadbeef".to_string())),
        );
        assert_eq!(parse_request("/meta/x.json"), ("meta/x.json".to_string(), None));
    }

    #[test]
    fn mime_liste_fermee() {
        assert_eq!(mime_for("a.jpg"), Some("image/jpeg"));
        assert_eq!(mime_for("a.json"), Some("application/json"));
        assert_eq!(mime_for("a.mkv"), None); // les médias ne transitent JAMAIS par la webview
        assert_eq!(mime_for("noext"), None);
    }
}
