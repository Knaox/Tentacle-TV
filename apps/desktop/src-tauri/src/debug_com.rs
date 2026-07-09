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
use std::time::{Duration, Instant};

use tauri::{command, AppHandle};
use windows::Win32::Foundation::CO_E_NOTINITIALIZED;
use windows::Win32::Media::Audio::{IMMDeviceEnumerator, MMDeviceEnumerator};
use windows::Win32::System::Com::{
    CoCreateInstance, CoGetApartmentType, CoInitializeEx, CoUninitialize, APTTYPE,
    APTTYPEQUALIFIER, CLSCTX_ALL, COINIT_MULTITHREADED,
};
use windows::Win32::System::Threading::GetCurrentThreadId;

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

/// État COM **du thread courant**.
///
/// ⚠ Ne jamais se fier à `CoCreateInstance` pour ça : dès qu'un MTA existe quelque part
/// dans le processus (mpv, WASAPI…), un thread sans apartment y est rattaché
/// implicitement et `CoCreateInstance` réussit — même après la destruction de sa STA.
/// `CoGetApartmentType` est le seul indicateur fiable.
fn com_status() -> String {
    let mut ty = APTTYPE::default();
    let mut qual = APTTYPEQUALIFIER::default();
    let apt = match unsafe { CoGetApartmentType(&mut ty, &mut qual) } {
        Ok(()) => {
            let name = match ty {
                APTTYPE(0) => "STA",
                APTTYPE(1) => "MTA",
                APTTYPE(2) => "NA (neutre)",
                APTTYPE(3) => "MAIN_STA",
                APTTYPE(n) => return format!("apartment inconnu ({n})"),
            };
            // Qualifier 5 = APTTYPEQUALIFIER_IMPLICIT_MTA : le thread n'a rien initialisé,
            // il est juste rattaché au MTA du processus. Sa propre STA est donc morte.
            let implicit = if qual == APTTYPEQUALIFIER(5) { " [IMPLICITE]" } else { "" };
            format!("{name}{implicit}")
        }
        Err(e) if e.code() == CO_E_NOTINITIALIZED => "AUCUN apartment".to_string(),
        Err(e) => format!("CoGetApartmentType → {:?}", e.code()),
    };
    let usable: windows::core::Result<IMMDeviceEnumerator> =
        unsafe { CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL) };
    format!("apartment={apt}, CoCreateInstance={}", if usable.is_ok() { "ok" } else { "échec" })
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

/// Rejoue l'**ancien** `set_audio_session_name` : commande non-`async`, donc l'énumération
/// WASAPI (≈11 sessions, un aller-retour COM inter-apartment chacune) s'exécute sur le
/// thread principal. Chaque milliseconde mesurée ici était une milliseconde d'UI gelée.
///
/// À lancer **pendant qu'un film démarre** : c'est le moment où mpv ouvre son flux WASAPI
/// et où le service audio est le plus susceptible de faire attendre l'appelant.
#[command]
pub fn debug_audio_on_main() -> String {
    let started = Instant::now();
    let r = unsafe { crate::audio_session::rename_sessions("Tentacle TV (debug)") };
    let ms = started.elapsed().as_millis();
    let s = format!(
        "{} : énumération WASAPI en {ms} ms (résultat: {})",
        which_thread(),
        if r.is_ok() { "ok" } else { "échec" }
    );
    eprintln!("[debug_com] audio_on_main → {s}");
    s
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

        // Le seul signal fiable : `S_OK` signifie que le thread n'avait plus d'apartment,
        // donc que le CoUninitialize() précédent a détruit la STA. (`CoCreateInstance`, lui,
        // continue de réussir via le MTA implicite du processus : indicateur inutilisable.)
        if hr.is_ok() {
            unsafe { CoUninitialize() }; // on équilibre le nôtre
            let fatal = format!(
                ">>> STA du thread principal détruite au {}e CoUninitialize() non apparié.\n\
                 >>> Elle détenait donc {} références (OleInitialize + CoInitializeEx de tao, + wry).\n\
                 >>> L'ancien set_audio_session_name en brûlait 2 par démarrage de lecture.\n",
                i - 1,
                i - 1
            );
            eprintln!("[debug_com] {fatal}");
            log.push_str(&fatal);
            return log;
        }

        unsafe { CoUninitialize() }; // le décrément non apparié : le bug
        let line = format!(
            "[{i}/{max}] CoInitializeEx(MTA)={hr:?} (STA encore là) → CoUninitialize() → {}",
            com_status()
        );
        eprintln!("[debug_com] {line}");
        log.push_str(&line);
        log.push('\n');
    }
    log.push_str(&format!("\n>>> STA toujours vivante après {max} décréments.\n"));
    log
}
