//! Opacité de la surface macOS — la fenêtre est opaque, sauf pendant la lecture.
//!
//! # Pourquoi ce module existe
//!
//! Une fenêtre Tauri `transparent: true` coûte très cher sur macOS, et le coût
//! est PERMANENT : le WindowServer doit recomposer la fenêtre entière en alpha à
//! chaque image d'affichage, même page totalement statique. Le bug est ouvert
//! chez Tauri (#15471) et mesuré sur Apple Silicon : ~620 mW contre ~75 mW pour
//! la même page en `transparent: false`, soit environ huit fois plus de GPU pour
//! un bénéfice visuel nul dès lors que rien ne transparaît derrière la fenêtre.
//! C'est ce qui rendait l'accueil moins fluide dans l'application que dans
//! Safari sur la MÊME machine, avec le MÊME moteur.
//!
//! Or nous n'avons besoin de transparence que PENDANT LA LECTURE : mpv dessine
//! dans une NSOpenGLView insérée SOUS la WKWebView (`gl_surface.rs`), et seule
//! une webview qui ne peint pas son fond la laisse voir. Hors lecture il n'y a
//! aucune vue GL — rien à laisser transparaître.
//!
//! # Le partage retenu
//!
//! `tauri.macos.conf.json` pose donc `transparent: false` : au démarrage, la
//! fenêtre ET la webview sont opaques, on est sur le chemin rapide. La
//! transparence n'est demandée qu'à l'entrée en lecture, et rendue à la sortie.
//! C'est exactement le partage que Linux tient déjà (`transparent: false` puis
//! alpha 0 sur la seule webview, cf. `linux/overlay.rs`). Windows garde
//! `transparent: true` : WebView2 y passe par DWM et le compositeur GPU de
//! Chromium, sans ce surcoût.
//!
//! # Répartition des rôles
//!
//! Le sens TRANSPARENT est le chemin critique — s'il échoue, la vidéo est
//! invisible. Il n'est donc pas traité ici : `mpv_init` passe par
//! `WebviewWindow::set_background_color`, l'API publique de Tauri, dont
//! l'implémentation wry est éprouvée.
//!
//! Le sens OPAQUE n'a pas d'équivalent public : `set_background_color` pose
//! TOUJOURS `drawsBackground = NO` sur macOS, quelle que soit la couleur. D'où
//! le code ci-dessous. Un échec ici ne casse rien de visible : on retombe
//! simplement sur le coût de composition d'avant.

use std::ffi::{c_void, CStr};
use objc2::msg_send;
use objc2::runtime::{AnyClass, AnyObject, Bool};

/// Donne à la fenêtre un fond noir opaque.
///
/// `transparent: false` suffit à rendre la NSWindow opaque, mais son fond reste
/// la couleur système. On force le noir : c'est `--surface-0` côté web
/// (`index.css`) et la couleur du script d'amorçage de `index.html`. C'est ce
/// qu'on aperçoit avant le premier rendu et pendant un redimensionnement à la
/// souris, là où l'on voyait le bureau.
///
/// SAFETY: appels Cocoa — doit s'exécuter sur le thread principal.
pub unsafe fn set_window_backdrop(ns_window: *mut c_void) {
    if ns_window.is_null() {
        return;
    }
    let window = ns_window as *mut AnyObject;

    let _: () = msg_send![window, setOpaque: Bool::YES];

    let Some(color_class) = AnyClass::get(CStr::from_bytes_with_nul(b"NSColor\0").unwrap()) else {
        return;
    };
    let black: *mut AnyObject = msg_send![color_class, blackColor];
    if !black.is_null() {
        let _: () = msg_send![window, setBackgroundColor: black];
    }
}

/// Rend son fond à la WKWebView — l'inverse de `set_background_color`.
///
/// `drawsBackground` est une clé KVC privée. C'est la MÊME que celle que wry
/// pose déjà, à la création via la `WKWebViewConfiguration` et à l'exécution via
/// `set_background_color` : on n'introduit donc aucun sélecteur privé
/// supplémentaire, seulement `setValue:forKey:`, qui est public.
///
/// Sans effet si la clé venait à disparaître d'une version de WebKit : on
/// resterait alors sur une webview transparente hors lecture, c'est-à-dire le
/// comportement d'avant ce module. Rien ne casse.
///
/// SAFETY: appels Cocoa — doit s'exécuter sur le thread principal.
pub unsafe fn restore_webview_background(ns_window: *mut c_void) {
    if ns_window.is_null() {
        return;
    }
    let window = ns_window as *mut AnyObject;
    let content_view: *mut AnyObject = msg_send![window, contentView];
    if content_view.is_null() {
        return;
    }
    let webview = super::gl_surface::find_webview(content_view);
    if webview.is_null() {
        return;
    }

    let Some(number_class) = AnyClass::get(CStr::from_bytes_with_nul(b"NSNumber\0").unwrap()) else {
        return;
    };
    let Some(string_class) = AnyClass::get(CStr::from_bytes_with_nul(b"NSString\0").unwrap()) else {
        return;
    };
    let yes: *mut AnyObject = msg_send![number_class, numberWithBool: Bool::YES];
    let key: *mut AnyObject = msg_send![
        string_class,
        stringWithUTF8String: c"drawsBackground".as_ptr()
    ];
    if yes.is_null() || key.is_null() {
        return;
    }
    let _: () = msg_send![webview, setValue: yes, forKey: key];
}
