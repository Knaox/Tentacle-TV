//! Démonstration A/B du gel Windows corrigé par le commit « CoUninitialize non apparié ».
//!
//! Compilé **uniquement en debug** (`cfg(debug_assertions)`) : absent des builds Store.
//! À utiliser depuis la console devtools (Ctrl+Shift+I en `pnpm dev:desktop`) :
//!
//!   await __TAURI_INTERNALS__.invoke('debug_com_check')   // état COM du thread principal
//!   await __TAURI_INTERNALS__.invoke('debug_com_fixed')   // chemin CORRIGÉ  → reste vivant
//!   await __TAURI_INTERNALS__.invoke('debug_com_break')   // chemin BUGUÉ    → gèle l'app
//!
//! Rappel du mécanisme : le thread principal est en STA (`OleInitialize` par tao,
//! `CoInitializeEx(APARTMENTTHREADED)` par wry) et détient donc 2 références COM.
//! `CoInitializeEx(MULTITHREADED)` y échoue avec RPC_E_CHANGED_MODE sans rien
//! incrémenter ; le `CoUninitialize()` qui suivait décrémentait quand même. Deux appels
//! — exactement ce que faisait `useSmtc.ts` par démarrage de lecture — fermaient COM sur
//! le thread principal, coupant les connexions RPC de la WebView2.

use std::sync::mpsc;
use std::time::Duration;

use tauri::{command, AppHandle};
use windows::Win32::Media::Audio::{IMMDeviceEnumerator, MMDeviceEnumerator};
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_ALL, COINIT_MULTITHREADED,
};

/// Teste si la bibliothèque COM est encore ouverte sur le thread courant.
/// Non destructif. Attendu : « VIVANT », ou l'erreur CO_E_NOTINITIALIZED (0x800401F0).
fn com_status() -> String {
    let r: windows::core::Result<IMMDeviceEnumerator> =
        unsafe { CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL) };
    match r {
        Ok(_) => "COM VIVANT sur le thread principal".to_string(),
        Err(e) => format!("COM MORT sur le thread principal — {:?} : {}", e.code(), e.message()),
    }
}

/// Sonde non destructive. Commande **non-async** : s'exécute donc sur le thread principal,
/// ce qui est précisément ce qu'on veut mesurer ici.
#[command]
pub fn debug_com_check() -> String {
    let s = com_status();
    eprintln!("[debug_com] check → {s}");
    s
}

/// Chemin **CORRIGÉ**, tel qu'`audio_session::set_audio_session_name` l'exécute désormais :
/// `async` + `spawn_blocking` (thread worker), et `CoUninitialize()` seulement si
/// `CoInitializeEx` a réussi. Le fait tourner 4 fois, puis vérifie le thread principal.
#[command]
pub async fn debug_com_fixed(app: AppHandle) -> String {
    for _ in 0..4 {
        tauri::async_runtime::spawn_blocking(|| unsafe {
            let owned = CoInitializeEx(None, COINIT_MULTITHREADED).is_ok();
            let _: windows::core::Result<IMMDeviceEnumerator> =
                CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL);
            if owned {
                CoUninitialize();
            }
        })
        .await
        .ok();
    }
    let s = format!("4 appels corrigés → {}", com_status_on_main(&app));
    eprintln!("[debug_com] fixed → {s}");
    s
}

/// L'apartment qui nous intéresse est celui du **thread principal** : on y fait exécuter
/// la sonde. Un timeout tient lieu de détecteur de gel — un thread principal figé ne
/// répondra jamais.
fn com_status_on_main(app: &AppHandle) -> String {
    let (tx, rx) = mpsc::channel();
    if app.run_on_main_thread(move || { let _ = tx.send(com_status()); }).is_err() {
        return "impossible de joindre le thread principal".to_string();
    }
    rx.recv_timeout(Duration::from_secs(2))
        .unwrap_or_else(|_| "le thread principal ne répond pas (gelé)".to_string())
}

/// Chemin **BUGUÉ** (l'ancien code), reproduit à la demande. Commande non-`async` ⇒ thread
/// principal. Deux `CoUninitialize()` non appariés suffisent à fermer COM : l'app se fige
/// instantanément, alors qu'un film en cours continue à jouer son et image.
///
/// ⚠ Après cet appel, l'app est à redémarrer.
#[command]
pub fn debug_com_break() -> String {
    let mut log = String::new();
    for i in 1..=2 {
        let hr = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) };
        unsafe { CoUninitialize() };
        log.push_str(&format!(
            "[{i}] CoInitializeEx(MTA)={hr:?} is_ok={} puis CoUninitialize() → {}\n",
            hr.is_ok(),
            com_status()
        ));
    }
    eprintln!("[debug_com] break →\n{log}");
    log
}
