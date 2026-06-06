//! Intégration des contrôles média système Windows (SMTC) via `souvlaki`.
//!
//! L'audio/vidéo est lue par libmpv (hors WebView), donc l'OS ne reçoit aucune
//! session média : les touches média ne mettent pas en pause et Stream Deck ne
//! voit pas l'app comme cible média. On enregistre ici une session SMTC sur le
//! HWND de la fenêtre principale, on pousse l'état (lecture/pause) + métadonnées,
//! et on relaie les boutons (play/pause/stop/next/prev) au frontend via
//! l'évènement Tauri `smtc-button` (qui pilote ensuite mpv).
//!
//! `souvlaki::MediaControls` doit vivre sur le thread qui possède le HWND et
//! pompe sa boucle de messages (le thread principal Tauri). Tous les accès
//! passent donc par `run_on_main_thread`.

use std::ffi::c_void;
use std::sync::Mutex;

use souvlaki::{MediaControlEvent, MediaControls, MediaMetadata, MediaPlayback, PlatformConfig};
use tauri::{command, AppHandle, Emitter, Manager};

struct SmtcControls(MediaControls);

// SAFETY : `MediaControls` n'est créé et manipulé que sur le thread principal
// (propriétaire du HWND), exclusivement via `run_on_main_thread`. On ne partage
// jamais réellement l'objet entre threads.
unsafe impl Send for SmtcControls {}

pub struct SmtcState(Mutex<Option<SmtcControls>>);

impl Default for SmtcState {
    fn default() -> Self {
        SmtcState(Mutex::new(None))
    }
}

/// Exécute `f` sur le thread principal avec les contrôles SMTC s'ils existent.
fn with_controls<F>(app: &AppHandle, f: F)
where
    F: FnOnce(&mut MediaControls) + Send + 'static,
{
    let app2 = app.clone();
    let _ = app.run_on_main_thread(move || {
        if let Some(c) = app2.state::<SmtcState>().0.lock().unwrap().as_mut() {
            f(&mut c.0);
        }
    });
}

/// Crée la session SMTC (idempotent) et branche le relais des boutons.
#[command]
pub fn smtc_init(app: AppHandle) -> Result<(), String> {
    let app2 = app.clone();
    app.run_on_main_thread(move || {
        if app2.state::<SmtcState>().0.lock().unwrap().is_some() {
            return; // déjà initialisé
        }
        let Some(window) = app2.get_webview_window("main") else {
            return;
        };
        let Ok(hwnd) = window.hwnd() else {
            return;
        };
        let config = PlatformConfig {
            dbus_name: "tentacle_tv",
            display_name: "Tentacle TV",
            hwnd: Some(hwnd.0 as *mut c_void),
        };
        let Ok(mut controls) = MediaControls::new(config) else {
            return;
        };
        let emit_app = app2.clone();
        let _ = controls.attach(move |event: MediaControlEvent| {
            let name = match event {
                MediaControlEvent::Play => "play",
                MediaControlEvent::Pause => "pause",
                MediaControlEvent::Toggle => "toggle",
                MediaControlEvent::Stop => "stop",
                MediaControlEvent::Next => "next",
                MediaControlEvent::Previous => "previous",
                _ => return,
            };
            let _ = emit_app.emit("smtc-button", name);
        });
        let _ = controls.set_playback(MediaPlayback::Playing { progress: None });
        *app2.state::<SmtcState>().0.lock().unwrap() = Some(SmtcControls(controls));
    })
    .map_err(|e| e.to_string())
}

/// Met à jour l'état de lecture exposé à l'OS ("playing" | "paused" | autre).
#[command]
pub fn smtc_set_playback(app: AppHandle, status: String) {
    with_controls(&app, move |c| {
        let pb = match status.as_str() {
            "playing" => MediaPlayback::Playing { progress: None },
            "paused" => MediaPlayback::Paused { progress: None },
            _ => MediaPlayback::Stopped,
        };
        let _ = c.set_playback(pb);
    });
}

/// Met à jour les métadonnées « lecture en cours » (titre, série, affiche).
#[command]
pub fn smtc_set_metadata(app: AppHandle, title: String, artist: String, cover: String) {
    with_controls(&app, move |c| {
        let _ = c.set_metadata(MediaMetadata {
            title: Some(&title),
            artist: if artist.is_empty() { None } else { Some(&artist) },
            cover_url: if cover.is_empty() { None } else { Some(&cover) },
            ..Default::default()
        });
    });
}

/// Repasse la session en "stopped" quand on quitte le lecteur.
#[command]
pub fn smtc_clear(app: AppHandle) {
    with_controls(&app, |c| {
        let _ = c.set_playback(MediaPlayback::Stopped);
    });
}
