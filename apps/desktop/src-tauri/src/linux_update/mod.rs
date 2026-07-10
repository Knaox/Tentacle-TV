//! Auto-updater Linux universel (aucun store, contrairement à macOS/Windows).
//!
//! - `detect_linux_install_format` : AppImage ($APPIMAGE) / pacman / deb / rpm.
//! - `download_update` : téléchargement vérifié SHA256 avec progression.
//! - `install_linux_update` : `pkexec` (deb/rpm/pacman) ou remplacement du
//!   fichier AppImage. Le front (apps/web/src/lib/linuxUpdate.ts) relance ensuite.
//!
//! L'updater Tauri officiel ne gère PAS pacman → implémentation maison uniforme.

// Sous-modules PUBLICS : `generate_handler!` (main.rs) doit référencer les
// commandes à leur chemin de définition (`linux_update::detect::…`) pour trouver
// la macro cachée `__cmd__*` que `#[tauri::command]` génère — un `pub use` de la
// fonction seule ne la ré-exporte pas.
pub mod detect;
pub mod install;
