//! Dispatch vers le thread principal GTK.
//!
//! Les commandes Tauri s'exécutent sur le runtime async (thread tokio), pas sur
//! le thread de la boucle GLib/GTK. Or `gtk_gl_area_make_current()` et
//! `mpv_render_context_free()` doivent tourner sur le thread qui possède le
//! contexte OpenGL (le thread GTK). `run_on_main` y marshale une closure et
//! attend son résultat — équivalent Linux du `run_on_main_thread` macOS.

use std::sync::mpsc;
use std::time::Duration;

use gtk::glib;

/// Exécute `f` sur le thread principal GTK et renvoie son résultat.
///
/// Si l'appel a déjà lieu sur le thread principal (signal GTK), exécute
/// directement pour éviter un auto-blocage. Sinon, planifie via
/// `MainContext::invoke` (thread-safe) et bloque jusqu'à ~5 s.
pub fn run_on_main<T, F>(f: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce() -> T + Send + 'static,
{
    let ctx = glib::MainContext::default();
    if ctx.is_owner() {
        return Ok(f());
    }
    let (tx, rx) = mpsc::channel();
    ctx.invoke(move || {
        let _ = tx.send(f());
    });
    rx.recv_timeout(Duration::from_secs(5))
        .map_err(|e| format!("main-thread dispatch timeout: {e}"))
}
