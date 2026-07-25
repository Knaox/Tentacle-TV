use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::{command, AppHandle, Builder, Emitter, Manager, Runtime, State, Window, WindowEvent};

/// Mémoire du plein écran À L'ENTRÉE du lecteur.
///
/// Le lecteur ne doit rendre la fenêtre à l'état fenêtré que s'il l'a lui-même
/// mise en plein écran. Si l'utilisateur avait DÉJÀ mis l'application en plein
/// écran (bouton vert, Ctrl+Cmd+F, menu Fenêtre) avant de lancer la vidéo,
/// quitter le lecteur ne doit rien défaire : ce plein écran est le sien.
///
/// L'état vit ici, côté natif, et non dans un ref React : le lecteur est
/// démonté puis remonté à chaque épisode (`key={itemId}`), et un ref repartirait
/// à zéro alors que la fenêtre, elle, est toujours en plein écran — au deuxième
/// épisode on conclurait à tort que le plein écran appartient à l'utilisateur.
#[derive(Default)]
pub struct FullscreenScope {
    /// `None`        — aucune session de lecteur ouverte.
    /// `Some(true)`  — la fenêtre était DÉJÀ en plein écran : ne rien défaire.
    /// `Some(false)` — la fenêtre était fenêtrée : on l'y ramène en sortant.
    entry: Mutex<Option<bool>>,
    /// Dernier état diffusé au frontend. `Resized` est émis à chaque image d'un
    /// redimensionnement à la souris : sans ce garde on inonderait l'IPC.
    last_broadcast: AtomicBool,
}

/// Ouvre la session plein écran du lecteur et renvoie l'état COURANT de la
/// fenêtre (le frontend s'en sert pour amorcer son état React).
///
/// Idempotente : un changement d'épisode remonte le lecteur sans fermer la
/// session, la mémoire d'entrée n'est donc pas réécrite.
#[command]
pub async fn player_fullscreen_enter(
    app: AppHandle,
    scope: State<'_, FullscreenScope>,
) -> Result<bool, String> {
    let window = app
        .get_webview_window("main")
        .ok_or("Window 'main' not found")?;

    let now = window.is_fullscreen().unwrap_or(false);
    let mut entry = scope.entry.lock().unwrap();
    if entry.is_none() {
        *entry = Some(now);
    }
    Ok(now)
}

/// Ferme la session : ne sort du plein écran QUE si c'est le lecteur qui l'a
/// activé. Ne le ré-active jamais — si l'utilisateur en est sorti pendant la
/// lecture, on respecte son geste.
#[command]
pub async fn player_fullscreen_leave(
    app: AppHandle,
    scope: State<'_, FullscreenScope>,
) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or("Window 'main' not found")?;

    let entry = scope.entry.lock().unwrap().take();
    if entry == Some(false) && window.is_fullscreen().unwrap_or(false) {
        window
            .set_fullscreen(false)
            .map_err(|e| format!("Failed to exit fullscreen: {e}"))?;
    }
    Ok(())
}

/// Bascule le plein écran (bouton du lecteur, touche F, double-clic).
/// Ne touche pas à la mémoire d'entrée : c'est `player_fullscreen_leave` qui
/// décide, à la sortie, s'il y a quelque chose à défaire.
#[command]
pub async fn toggle_fullscreen(app: AppHandle) -> Result<bool, String> {
    let window = app
        .get_webview_window("main")
        .ok_or("Window 'main' not found")?;

    let next = !window.is_fullscreen().unwrap_or(false);
    window
        .set_fullscreen(next)
        .map_err(|e| format!("Failed to toggle fullscreen: {e}"))?;

    Ok(next)
}

/// Diffuse au frontend tout changement de plein écran, QUELLE QUE SOIT SA
/// SOURCE — bouton vert, Ctrl+Cmd+F, menu Fenêtre, Mission Control, ou notre
/// propre `toggle_fullscreen`.
///
/// Branché sur `Resized` : sur macOS, tao émet un redimensionnement depuis
/// `windowDidEnterFullScreen:` / `windowDidExitFullScreen:`, et son délégué
/// tient son état à jour dès `windowWillEnterFullScreen:` — `is_fullscreen()`
/// est donc déjà juste au premier `Resized` de la transition, l'icône bascule
/// dès le DÉBUT de l'animation d'espace.
///
/// Sans cette diffusion, rien ne détectait un plein écran déclenché hors de
/// l'application : l'icône du bouton, la touche Échap et les gardes de sortie
/// partaient en désaccord avec la fenêtre réelle.
fn broadcast_fullscreen<R: Runtime>(window: &Window<R>, event: &WindowEvent) {
    if !matches!(event, WindowEvent::Resized(_)) {
        return;
    }
    let Some(scope) = window.try_state::<FullscreenScope>() else {
        return;
    };
    let now = window.is_fullscreen().unwrap_or(false);
    if scope.last_broadcast.swap(now, Ordering::Relaxed) != now {
        let _ = window.emit("window://fullscreen", now);
    }
}

/// Point d'installation unique — garde `main.rs` à une seule ligne de delta.
pub fn install<R: Runtime>(builder: Builder<R>) -> Builder<R> {
    builder
        .manage(FullscreenScope::default())
        .on_window_event(broadcast_fullscreen)
}
