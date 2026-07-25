use std::ffi::{c_void, CStr};
use objc2::msg_send;
use objc2::runtime::{AnyClass, AnyObject, Bool};

/// Rend la NSWindow OPAQUE, une fois pour toutes au demarrage.
///
/// `transparent: true` (tauri.conf.json) est REQUIS sur macOS, mais pour une
/// seule raison : c'est lui qui fait poser `drawsBackground = NO` par wry sur
/// la WKWebViewConfiguration. Sans ce fond retire, la NSOpenGLView de mpv —
/// inseree SOUS la webview par `gl_surface.rs` — resterait invisible et les
/// controles HTML n'auraient rien a surplomber.
///
/// Seulement, tao applique le meme drapeau a la FENETRE (`setOpaque:NO` +
/// `clearColor`). Et ca, rien ne le demande : une fenetre non opaque sert a
/// laisser voir le BUREAU derriere, or la video vit DANS la fenetre, sous la
/// webview. On paie donc un chemin de composition sans jamais s'en servir.
///
/// Le cout est permanent et mesurable : le WindowServer doit fusionner la
/// fenetre entiere avec ce qu'il y a derriere a CHAQUE image, sur toutes les
/// pages, meme a l'arret — et la couche racine de WebKit ne peut jamais etre
/// traitee comme opaque. C'est ce qui rendait l'accueil moins fluide dans
/// l'app que dans Safari sur la MEME machine, avec le MEME moteur.
///
/// Linux tient deja le bon partage (`tauri.linux.conf.json` → `transparent:
/// false`, puis `set_background_color(alpha 0)` sur la seule webview) : fenetre
/// opaque, webview transparente. On aligne macOS dessus, la config Tauri ne
/// permettant pas de dissocier les deux.
///
/// Noir : la meme couleur de repli que `--surface-0` cote web (`index.css`) et
/// que le script d'amorcage de `index.html`. Hors lecture c'est ce fond qu'on
/// apercoit a la place du bureau si la feuille de style n'a pas encore peint ;
/// pendant la lecture il reste cache par la vue GL.
///
/// Aucune bascule a prevoir pour la lecture : la fenetre peut rester opaque en
/// permanence, seule la webview a besoin d'etre sans fond.
///
/// SAFETY: appels Cocoa — doit s'executer sur le thread principal.
pub unsafe fn make_window_opaque(ns_window: *mut c_void) {
    if ns_window.is_null() {
        return;
    }
    let window = ns_window as *mut AnyObject;

    let _: () = msg_send![window, setOpaque: Bool::YES];

    // `setOpaque:YES` seul ne suffit pas : tao a pose `clearColor` comme fond de
    // fenetre. Une fenetre declaree opaque dont le fond ne peint rien laisse des
    // trainees la ou la webview ne couvre pas encore.
    let Some(color_class) = AnyClass::get(CStr::from_bytes_with_nul(b"NSColor\0").unwrap()) else {
        return;
    };
    let black: *mut AnyObject = msg_send![color_class, blackColor];
    if !black.is_null() {
        let _: () = msg_send![window, setBackgroundColor: black];
    }
}
