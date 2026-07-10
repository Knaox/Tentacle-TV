use std::process::Command;

/// Détecte le format d'installation de l'app en cours d'exécution.
/// Renvoie `"appimage"` | `"pacman"` | `"deb"` | `"rpm"` | `"unknown"`.
///
/// Ordre : (1) `$APPIMAGE` (exporté par le runtime AppImage type-2) ;
/// (2) le gestionnaire qui possède le binaire courant (`pacman -Qo` /
/// `dpkg -S` / `rpm -qf`) ; (3) sinon inconnu (installé hors gestionnaire →
/// on ne propose pas d'auto-install).
#[tauri::command]
pub fn detect_linux_install_format() -> String {
    if std::env::var_os("APPIMAGE").is_some() {
        return "appimage".to_string();
    }
    let exe = match std::env::current_exe() {
        Ok(p) => p.to_string_lossy().into_owned(),
        Err(_) => return "unknown".to_string(),
    };
    if pkg_owns("pacman", &["-Qo", &exe]) {
        return "pacman".to_string();
    }
    if pkg_owns("dpkg", &["-S", &exe]) {
        return "deb".to_string();
    }
    if pkg_owns("rpm", &["-qf", &exe]) {
        return "rpm".to_string();
    }
    "unknown".to_string()
}

/// `true` si `cmd args` s'exécute ET réussit (⇒ le paquet possède le binaire).
fn pkg_owns(cmd: &str, args: &[&str]) -> bool {
    Command::new(cmd)
        .args(args)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}
