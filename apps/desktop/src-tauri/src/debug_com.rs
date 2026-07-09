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
use std::sync::OnceLock;
use std::time::Duration;

use tauri::{command, AppHandle};
use windows::Win32::System::Threading::GetCurrentThreadId;
use windows::Win32::Media::Audio::{IMMDeviceEnumerator, MMDeviceEnumerator};
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_ALL, COINIT_MULTITHREADED,
};

/// Id du thread de la boucle d'évènements, mémorisé au `setup()`.
static MAIN_TID: OnceLock<u32> = OnceLock::new();

pub fn remember_main_thread(tid: u32) {
    let _ = MAIN_TID.set(tid);
}

/// « thread principal » ou « thread worker » — pour vérifier sans supposer.
fn which_thread() -> String {
    let cur = unsafe { GetCurrentThreadId() };
    match MAIN_TID.get() {
        Some(&main) if main == cur => format!("thread PRINCIPAL (tid={cur})"),
        Some(&main) => format!("thread worker (tid={cur}, principal={main})"),
        None => format!("tid={cur} (principal inconnu)"),
    }
}

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
    let s = format!("{} → {}", which_thread(), com_status());
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

/// Chemin **BUGUÉ** (l'ancien code), reproduit à la demande. Commande non-`async`, donc
/// exécutée sur le thread principal — `debug_com_check` le vérifie plutôt que de le supposer.
///
/// Chaque itération rejoue un appel de l'ancien `set_audio_session_name` : un
/// `CoInitializeEx(MTA)` qui échoue (RPC_E_CHANGED_MODE, thread déjà en STA) suivi d'un
/// `CoUninitialize()` non apparié, qui décrémente une référence qui ne nous appartient pas.
/// On s'arrête au premier décrément fatal, pour connaître le nombre exact de références.
///
/// Chaque ligne part sur **stderr** (terminal `pnpm dev:desktop`), qui survit au gel :
/// une fois COM fermé, l'IPC de la WebView2 ne renverra plus la valeur de retour.
///
/// ⚠ Après le décrément fatal, l'app est à redémarrer.
#[command]
pub fn debug_com_break(times: Option<u32>) -> String {
    let max = times.unwrap_or(12);
    eprintln!("[debug_com] break sur {} — {}", which_thread(), com_status());

    let mut log = String::new();
    for i in 1..=max {
        let hr = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) };
        unsafe { CoUninitialize() };
        let status = com_status();
        let line = format!(
            "[{i}/{max}] CoInitializeEx(MTA)={hr:?} is_ok={} → CoUninitialize() → {status}",
            hr.is_ok()
        );
        eprintln!("[debug_com] {line}");
        log.push_str(&line);
        log.push('\n');

        if status.starts_with("COM MORT") {
            let fatal = format!(
                "\n>>> COM fermé au {i}e CoUninitialize() : le thread principal détenait {i} référence(s).\n\
                 >>> L'ancien code en brûlait 2 par démarrage de lecture (useSmtc.ts:102 et :104).\n"
            );
            eprintln!("[debug_com]{fatal}");
            log.push_str(&fatal);
            return log;
        }
    }
    log.push_str(&format!("\n>>> COM toujours vivant après {max} décréments — relancer avec times plus grand.\n"));
    log
}
