use std::fs;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::process::Command;

use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter};

/// Télécharge `url` vers un fichier temporaire en émettant la progression
/// (`linux-update-progress`, 0.0..1.0), vérifie le SHA256 (si fourni), et
/// renvoie le chemin local. Blocage réseau isolé sur un thread dédié.
#[tauri::command]
pub async fn download_update(
    app: AppHandle,
    url: String,
    sha256: String,
    file_name: String,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || download_blocking(&app, &url, &sha256, &file_name))
        .await
        .map_err(|e| format!("tâche de téléchargement interrompue: {e}"))?
}

fn download_blocking(app: &AppHandle, url: &str, sha256: &str, file_name: &str) -> Result<String, String> {
    let resp = ureq::get(url)
        .call()
        .map_err(|e| format!("téléchargement échoué: {e}"))?;
    let total: u64 = resp
        .header("Content-Length")
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);

    let dir = std::env::temp_dir().join("tentacle-update");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    // Assainit le nom (jamais de séparateur de chemin issu du manifeste).
    let safe = file_name.replace(['/', '\\'], "_");
    let path = dir.join(&safe);

    let mut reader = resp.into_reader();
    let mut file = fs::File::create(&path).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 65536];
    let mut done: u64 = 0;
    loop {
        let n = reader.read(&mut buf).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        file.write_all(&buf[..n]).map_err(|e| e.to_string())?;
        hasher.update(&buf[..n]);
        done += n as u64;
        if total > 0 {
            let _ = app.emit("linux-update-progress", done as f64 / total as f64);
        }
    }
    file.flush().map_err(|e| e.to_string())?;

    // Intégrité : sig locale pacman = Optional → le SHA256 est LA garantie.
    if !sha256.is_empty() {
        let got = hex::encode(hasher.finalize());
        if !got.eq_ignore_ascii_case(sha256) {
            let _ = fs::remove_file(&path);
            return Err(format!("SHA256 invalide (attendu {sha256}, obtenu {got})"));
        }
    }
    Ok(path.to_string_lossy().into_owned())
}

/// Installe le paquet téléchargé selon `format` : deb/rpm/pacman via `pkexec`
/// (invite polkit), AppImage par remplacement direct du fichier `$APPIMAGE`.
/// Isolé sur un thread bloquant (pkexec + gestionnaire de paquets = plusieurs s).
#[tauri::command]
pub async fn install_linux_update(path: String, format: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || install_blocking(&path, &format))
        .await
        .map_err(|e| format!("tâche d'installation interrompue: {e}"))?
}

fn install_blocking(path: &str, format: &str) -> Result<(), String> {
    match format {
        "pacman" => elevate("pacman", &["-U", "--noconfirm", path]),
        "deb" => elevate("apt-get", &["install", "-y", path]),
        "rpm" => elevate("dnf", &["install", "-y", path]),
        "appimage" => swap_appimage(path),
        other => Err(format!("format non géré: {other}")),
    }
}

/// Exécute `mgr args` en root via `pkexec` (invite graphique polkit). Si pkexec
/// est absent, renvoie la commande à lancer manuellement (dégradation propre).
fn elevate(mgr: &str, args: &[&str]) -> Result<(), String> {
    if which("pkexec").is_none() {
        return Err(format!(
            "pkexec introuvable (installe polkit). Installe à la main : sudo {} {}",
            mgr,
            args.join(" ")
        ));
    }
    let mut full: Vec<&str> = Vec::with_capacity(args.len() + 1);
    full.push(mgr);
    full.extend_from_slice(args);
    let status = Command::new("pkexec")
        .args(&full)
        .status()
        .map_err(|e| format!("pkexec: {e}"))?;
    if status.success() {
        Ok(())
    } else {
        // 126 = non autorisé, 127 = annulé par l'utilisateur (dialogue polkit).
        Err(format!(
            "installation annulée ou refusée (pkexec code {:?})",
            status.code()
        ))
    }
}

/// Remplace le fichier AppImage courant (`$APPIMAGE`) par le nouveau et le rend
/// exécutable. Sauvegarde `.bak` restaurée si la copie échoue.
fn swap_appimage(new_path: &str) -> Result<(), String> {
    let target = std::env::var("APPIMAGE")
        .map_err(|_| "$APPIMAGE absent (l'app n'est pas lancée en AppImage)".to_string())?;
    let backup = format!("{target}.bak");
    let _ = fs::rename(&target, &backup);
    if let Err(e) = fs::copy(new_path, &target) {
        let _ = fs::rename(&backup, &target); // rollback
        return Err(format!("remplacement AppImage échoué: {e}"));
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&target, fs::Permissions::from_mode(0o755));
    }
    let _ = fs::remove_file(&backup);
    Ok(())
}

/// Cherche un exécutable dans le `PATH`.
fn which(bin: &str) -> Option<PathBuf> {
    std::env::var_os("PATH").and_then(|paths| {
        std::env::split_paths(&paths)
            .map(|p| p.join(bin))
            .find(|p| p.is_file())
    })
}
