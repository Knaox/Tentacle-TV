//! Surface vidéo Windows : fenêtre enfant de libmpv (mode `--wid`) et opacité
//! de la webview qui la recouvre.
//!
//! `tauri-plugin-libmpv` passe le HWND top-level de Tauri à mpv via l'option `wid`.
//! mpv crée alors une fenêtre `WS_CHILD | WS_VISIBLE` sous ce HWND, mais depuis son
//! propre thread (`gui_thread`, avec sa boucle `GetMessageW`). Windows attache les
//! files d'entrée des deux threads : si le thread fenêtre de mpv entre en boucle
//! modale (déplacement de fenêtre, redimensionnement) ou conserve une capture souris
//! orpheline, **plus aucune entrée n'est délivrée à l'app** — le son et l'image
//! continuent (threads core/VO/audio distincts) mais l'UI est morte.
//!
//! Les options `window-dragging=no` / `input-cursor=no` (voir `mpvRuntime.ts`) coupent
//! les déclencheurs connus. Ici on ferme la porte au niveau Win32 : la fenêtre enfant
//! ne doit recevoir **aucun** message d'entrée, quels que soient les défauts de mpv.

use std::ffi::c_void;
use std::thread::sleep;
use std::time::Duration;

use tauri::command;
use windows::core::w;
use windows::Win32::Foundation::HWND;
use windows::Win32::UI::Input::KeyboardAndMouse::EnableWindow;
use windows::Win32::UI::WindowsAndMessaging::{
    FindWindowExW, GetWindowLongPtrW, SetWindowLongPtrW, SetWindowPos, GWL_EXSTYLE, HWND_BOTTOM,
    SWP_ASYNCWINDOWPOS, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSENDCHANGING, SWP_NOSIZE,
    WS_EX_NOACTIVATE, WS_EX_TRANSPARENT,
};

/// La fenêtre enfant est créée de façon asynchrone par le `gui_thread` de mpv, juste
/// après `mpv_initialize()`. On la cherche pendant ~500 ms avant d'abandonner.
const FIND_ATTEMPTS: u32 = 10;
const FIND_DELAY: Duration = Duration::from_millis(50);

fn find_mpv_child(parent: HWND) -> Option<HWND> {
    for _ in 0..FIND_ATTEMPTS {
        // Classe `MPV_WINDOW_CLASS_NAME` (= L"mpv"), cf. video/out/w32_common.c.
        if let Ok(child) = unsafe { FindWindowExW(Some(parent), None, w!("mpv"), None) } {
            if !child.is_invalid() {
                return Some(child);
            }
        }
        sleep(FIND_DELAY);
    }
    None
}

fn harden(child: HWND) {
    unsafe {
        // WS_DISABLED : la fenêtre ne reçoit plus aucun message souris/clavier, donc
        // son thread ne peut plus entrer en boucle modale ni appeler SetCapture().
        // C'était le comportement historique de libmpv (cf. mpv#6762).
        let _ = EnableWindow(child, false);

        // Hit-testing traversant + jamais de vol de focus au clic.
        let exstyle = GetWindowLongPtrW(child, GWL_EXSTYLE) as u32;
        let hardened = exstyle | WS_EX_TRANSPARENT.0 | WS_EX_NOACTIVATE.0;
        if hardened != exstyle {
            SetWindowLongPtrW(child, GWL_EXSTYLE, hardened as isize);
        }

        // La WebView2 (fenêtre sœur) doit rester au-dessus : les contrôles HTML du
        // lecteur sont dessinés par-dessus la vidéo, à travers la fenêtre transparente.
        // SWP_ASYNCWINDOWPOS : la fenêtre appartient au thread de mpv ; sans ce flag,
        // SetWindowPos lui enverrait un message *synchrone* et bloquerait ici si ce
        // thread est occupé — exactement le couplage qu'on cherche à supprimer.
        let _ = SetWindowPos(
            child,
            Some(HWND_BOTTOM),
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_ASYNCWINDOWPOS | SWP_NOSENDCHANGING,
        );
    }
}

/// Transparence de la webview — demandée le temps d'une lecture, rendue après.
///
/// # Pourquoi la fenêtre n'est plus `transparent: true`
///
/// C'était le dernier OS à la garder en permanence, et ça se voyait : chaque
/// transition un peu large — ouverture d'une fiche depuis la recherche, sortie
/// du lecteur — scintillait, alors que le MÊME moteur Chromium dans un
/// navigateur ordinaire, sur la même machine, ne scintillait pas. La différence
/// n'était donc pas le moteur mais la fenêtre.
///
/// `transparent: true` fait deux choses distinctes sur Windows, et une seule
/// nous sert :
///
/// - **tao** appelle `DwmEnableBlurBehindWindow` sur une région vide. La fenêtre
///   quitte le chemin de présentation opaque : DWM doit désormais la composer en
///   alpha par-dessus le bureau à chaque image, et la présentation n'est plus
///   une simple chaîne d'échange vsyncée. C'est de là que vient la déchirure,
///   et ça ne sert **à rien** ici : mpv dessine DANS la fenêtre, rien n'a jamais
///   eu à transparaître vers le bureau.
/// - **wry** pose le fond de la WebView2 à alpha nul. Ça, c'est indispensable —
///   c'est ce qui laisse voir la fenêtre enfant de mpv, placée en dessous.
///
/// D'où le partage retenu, le même que macOS (`macos/window_opacity.rs`) et que
/// Linux (`linux/overlay.rs`) : la fenêtre reste opaque (`tauri.windows.conf.json`),
/// et seule la webview devient transparente, le temps d'une lecture.
///
/// # Pourquoi une seule commande suffit ici
///
/// Sur macOS il a fallu écrire le sens OPAQUE à la main, wry y forçant
/// `drawsBackground = NO` quelle que soit la couleur. Rien de tel sur Windows :
/// `set_background_color` y ramène l'alpha à 255 dès qu'il est non nul
/// (cf. wry `webview2/mod.rs`), donc l'aller-retour tient dans l'API publique
/// de Tauri, dont l'implémentation est éprouvée.
///
/// # Ordre d'appel
///
/// L'invariant est celui du lecteur : jamais d'instant où la webview ET la page
/// sont transparentes en même temps, sinon on voit le bureau. À l'entrée, la
/// webview passe transparente AVANT que la page ne le devienne (`ready`) ; à la
/// sortie, la page redevient opaque d'abord, la webview ensuite. Les deux
/// opaques en même temps est en revanche sans danger : au pire un fond noir.
#[command]
pub fn player_surface_transparent(window: tauri::WebviewWindow, on: bool) -> Result<(), String> {
    // Alpha nul : la couleur n'a aucune importance. Alpha 255 : opaque, et le
    // noir est `--surface-0`, comme le fond d'amorçage de `index.html`.
    let color = if on {
        tauri::webview::Color(0, 0, 0, 0)
    } else {
        tauri::webview::Color(0, 0, 0, 255)
    };
    window
        .set_background_color(Some(color))
        .map_err(|e| format!("webview background: {e}"))
}

/// Désarme la fenêtre vidéo de mpv. Appelée depuis le frontend juste après `api.init()`.
///
/// Jamais fatale : si la fenêtre n'est pas trouvée (mpv en `audio-only`, changement de
/// classe upstream), on renvoie `Ok` — la lecture ne doit pas dépendre de ce durcissement.
#[command]
pub async fn mpv_harden_child_window(window: tauri::Window) -> Result<bool, String> {
    let parent = window.hwnd().map_err(|e| e.to_string())?;
    let parent = parent.0 as isize;

    // `FindWindowExW` + `sleep` : hors du thread UI et hors du runtime async.
    tauri::async_runtime::spawn_blocking(move || {
        let parent = HWND(parent as *mut c_void);
        match find_mpv_child(parent) {
            Some(child) => {
                harden(child);
                true
            }
            None => {
                eprintln!("[mpv_window] fenêtre enfant mpv introuvable — durcissement ignoré");
                false
            }
        }
    })
    .await
    .map_err(|e| e.to_string())
}
