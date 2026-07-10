//! Montage de l'overlay GTK : reparente la webview WebKitGTK de Tauri au-dessus
//! d'un GtkGLArea (vidéo mpv) dans un GtkOverlay, et branche le rendu.
//!
//!   vbox (Tauri)            vbox (Tauri)
//!   └── WebView     ──►     └── Overlay
//!                              ├── GLArea   (vidéo mpv, enfant principal)
//!                              └── WebView  (transparente, par-dessus)

use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::time::Duration;

use gtk::gdk;
use gtk::glib;
use gtk::prelude::*;
use tauri::WebviewWindow;
use webkit2gtk::WebViewExt;

use super::{render, RenderState};

/// Intervalle du timer qui draine `needs_render` → `queue_render`. 8 ms ≈ 125 Hz,
/// plus léger que la boucle 4 ms du render thread macOS ; borne la latence
/// d'affichage d'une nouvelle frame mpv. Coût à vide = un load atomique.
const RENDER_TICK: Duration = Duration::from_millis(8);

/// Planifie le montage de l'overlay sur le thread principal GTK.
///
/// Non bloquant : `with_webview` met la closure en file de la boucle
/// d'évènements — on ne peut donc pas attendre son résultat depuis le `setup`
/// (la boucle n'a pas encore démarré). Toute erreur est journalisée.
///
/// ⚠️ Ordre critique : la fenêtre est créée CACHÉE (`visible: false` dans
/// `tauri.linux.conf.json`) et n'est montrée qu'ICI, une fois le reparentage
/// fait. Reparenter la webview APRÈS son premier affichage (realize) corrompt
/// le suivi de « damage » de WebKitGTK : chaque élément HTML déplacé/fermé
/// laissait un fantôme à l'écran jusqu'au prochain redimensionnement.
pub fn setup_overlay(window: &WebviewWindow, state: Arc<RenderState>) {
    let win = window.clone();
    let res = window.with_webview(move |pw| {
        if let Err(e) = build_overlay(pw.inner(), &state) {
            eprintln!("[linux/overlay] échec du montage de l'overlay : {e}");
        }
        // Révèle la fenêtre dans tous les cas (overlay monté ou pas).
        if let Err(e) = win.show() {
            eprintln!("[linux/overlay] window.show() a échoué : {e}");
        }
    });
    if let Err(e) = res {
        eprintln!("[linux/overlay] with_webview a échoué : {e}");
        // La closure ne tournera pas : montrer la fenêtre quand même.
        let _ = window.show();
    }
}

/// Reparente la webview, crée l'overlay + le GLArea, rend la webview transparente
/// et branche le signal `render` + le timer. Exécuté sur le thread principal GTK.
fn build_overlay(webview: webkit2gtk::WebView, state: &Arc<RenderState>) -> Result<(), String> {
    // Compositing accéléré OBLIGATOIRE : sans lui (politique NEVER, cf. note
    // dans main.rs sur WEBKIT_DISABLE_DMABUF_RENDERER), WebKit peint en cairo
    // incrémental et laisse des fantômes au-dessus de la vidéo transparente.
    {
        use webkit2gtk::{HardwareAccelerationPolicy, SettingsExt, WebViewExt};
        if let Some(settings) = WebViewExt::settings(&webview) {
            settings.set_hardware_acceleration_policy(HardwareAccelerationPolicy::Always);
        }
    }
    let webview_widget = webview.upcast_ref::<gtk::Widget>();

    // Structure Tauri : Window → vbox (GtkBox) → WebView.
    let vbox = webview_widget
        .parent()
        .and_then(|w| w.downcast::<gtk::Box>().ok())
        .ok_or("parent de la webview absent ou pas un GtkBox")?;
    // ⚠️ Tauri (tauri-runtime-wry `undecorated_resizing`) branche un handler
    // button-press sur la webview qui fait, à CHAQUE clic :
    //   webview.parent().parent().downcast::<gtk::Window>().unwrap()
    // → le GRAND-PARENT de la webview DOIT rester la GtkWindow, sinon panic
    // (abort, car on ne peut pas dérouler à travers le C). On remplace donc le
    // vbox par l'Overlay comme enfant DIRECT de la fenêtre :
    //   Window → Overlay → { GLArea (dessous), WebView (dessus) }.
    let window = vbox
        .parent()
        .and_then(|w| w.downcast::<gtk::Window>().ok())
        .ok_or("grand-parent de la webview absent ou pas une GtkWindow")?;

    // Surface vidéo : enfant principal de l'overlay (dessous).
    let gl_area = gtk::GLArea::new();
    gl_area.set_has_depth_buffer(false);
    gl_area.set_has_stencil_buffer(false);
    gl_area.set_hexpand(true);
    gl_area.set_vexpand(true);

    let overlay = gtk::Overlay::new();

    // Reparentage. On garde une réf vive à la webview via `webview` le temps de
    // la déplacer ; `add_overlay` la ré-ancre ensuite. Le vbox devient orphelin :
    // tao garde sa réf (pas de destruction) et l'app n'a aucun menu natif qui
    // l'utiliserait.
    vbox.remove(webview_widget);
    window.remove(&vbox);
    overlay.add(&gl_area);
    overlay.add_overlay(webview_widget);
    overlay.set_overlay_pass_through(webview_widget, false); // la webview reçoit l'input
    webview_widget.set_halign(gtk::Align::Fill);
    webview_widget.set_valign(gtk::Align::Fill);
    window.add(&overlay);

    // Fond de la webview transparent (alpha 0). Le contenu web contrôle l'opacité
    // réelle : opaque hors page lecteur, transparent sur le lecteur → la vidéo du
    // GLArea apparaît, contrôles HTML par-dessus.
    webview.set_background_color(&gdk::RGBA::new(0.0, 0.0, 0.0, 0.0));

    overlay.show_all();

    // Pointeur du GLArea persistant (vit tant que la fenêtre) pour le destroy.
    state.gl_area.store(gl_area.as_ptr() as *mut _, Ordering::SeqCst);

    // Signal `render` : mpv dessine dans le FBO courant de GTK.
    let state_render = Arc::clone(state);
    gl_area.connect_render(move |area, ctx| render::on_render(&state_render, area, ctx));

    // Timer : draine needs_render → queue_render sur le thread GTK.
    let state_tick = Arc::clone(state);
    let area_weak = gl_area.downgrade();
    glib::timeout_add_local(RENDER_TICK, move || {
        if state_tick.needs_render.swap(false, Ordering::SeqCst) {
            if let Some(area) = area_weak.upgrade() {
                area.queue_render();
            }
        }
        glib::ControlFlow::Continue
    });

    Ok(())
}
