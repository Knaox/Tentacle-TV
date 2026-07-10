//! Lecteur vidéo Linux — mpv Render API OpenGL dans un GtkGLArea, webview
//! WebKitGTK transparente au-dessus dans un GtkOverlay (une seule fenêtre).
//!
//! Remplace l'embarquement `--wid` de `tauri-plugin-libmpv` : sur Linux,
//! WebKitGTK ne sait pas composer du HTML transparent au-dessus d'une fenêtre
//! vidéo NATIVE (limite « airspace »), donc la vidéo cachait l'overlay HTML des
//! contrôles. Ici mpv dessine dans un GtkGLArea (widget composé par GTK, pas une
//! fenêtre native) → la webview transparente se compose correctement par-dessus.
//!
//! Miroir du module macOS (`src/macos/`) : mêmes commandes Tauri (`mpv_init`,
//! `mpv_command`, `mpv_set_property`, `mpv_get_property`, `mpv_destroy`) et mêmes
//! évènements (`mpv://property-change`, `mpv://event`) → l'adaptateur JS et
//! `useDesktopPlayer` fonctionnent à l'identique. macOS/Windows NON modifiés.

pub mod commands;
mod events;
mod glproc;
mod mpv_ffi;
mod overlay;
mod render;
mod util;

use std::ffi::c_void;
use std::sync::atomic::{AtomicBool, AtomicPtr};
use std::sync::Mutex;
use std::thread;

use tauri::AppHandle;

pub use mpv_ffi::MpvLib;
pub use overlay::setup_overlay;

/// État partagé du lecteur, géré par Tauri (`Arc<RenderState>`).
///
/// Le GtkGLArea est **persistant** (créé une fois au setup, vit tant que la
/// fenêtre) ; seuls `mpv_handle` + `render_ctx` sont créés/détruits à chaque
/// lecture. Les pointeurs bruts mpv sont protégés par Mutex ; `gl_area` n'est
/// déréférencé que sur le thread principal GTK.
pub struct RenderState {
    pub mpv_lib: MpvLib,
    pub mpv_handle: Mutex<*mut c_void>,
    pub render_ctx: Mutex<*mut c_void>,
    /// `*mut GtkGLArea` du GLArea persistant. Nul avant le setup de l'overlay.
    pub gl_area: AtomicPtr<c_void>,
    /// Posé par le wakeup mpv (thread render mpv) → drainé par le timer 8 ms sur
    /// le thread GTK qui appelle `queue_render()`.
    pub needs_render: AtomicBool,
    /// Posé par `mpv_init` : demande la création paresseuse du render context au
    /// prochain signal `render` (là où le contexte OpenGL est courant).
    pub want_render_ctx: AtomicBool,
    /// Signal d'arrêt du thread d'évènements mpv.
    pub should_stop: AtomicBool,
    pub app_handle: Mutex<Option<AppHandle>>,
    pub event_thread: Mutex<Option<thread::JoinHandle<()>>>,
}

// SAFETY: les pointeurs bruts sont protégés par Mutex/Atomic et n'accèdent à
// l'état GTK que sur le thread principal.
unsafe impl Send for RenderState {}
unsafe impl Sync for RenderState {}

impl RenderState {
    pub fn new(mpv_lib: MpvLib) -> Self {
        Self {
            mpv_lib,
            mpv_handle: Mutex::new(std::ptr::null_mut()),
            render_ctx: Mutex::new(std::ptr::null_mut()),
            gl_area: AtomicPtr::new(std::ptr::null_mut()),
            needs_render: AtomicBool::new(false),
            want_render_ctx: AtomicBool::new(false),
            should_stop: AtomicBool::new(false),
            app_handle: Mutex::new(None),
            event_thread: Mutex::new(None),
        }
    }
}
