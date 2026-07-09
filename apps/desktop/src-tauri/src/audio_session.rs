//! Nomme explicitement la session audio WASAPI du process (mpv lit en
//! in-process) via `IAudioSessionControl::SetDisplayName`.
//!
//! Sans ça, Windows affiche un nom par défaut (« System Sounds ») dans le
//! mixeur de volume et les outils tiers (Stream Deck) ne ciblent pas l'app.
//! Microsoft impose d'assigner le nom sur la session une fois le 1er flux créé,
//! donc on appelle cette commande quand la lecture démarre.
//!
//! ⚠ Cette commande DOIT rester `async` : une commande Tauri non-`async` s'exécute
//! sur le **thread principal**, celui de la boucle d'évènements et de la WebView2.
//! Or `tao` y appelle `OleInitialize`, qui initialise COM en **STA**. Faire tourner
//! l'énumération WASAPI (appels COM inter-apartment, bloquants) sur ce thread le fige,
//! et surtout un `CoUninitialize()` non apparié y « ferme la bibliothèque COM du thread
//! et force la fermeture de toutes ses connexions RPC » — c'est-à-dire celles de la
//! WebView2. D'où : le film continue (mpv a ses propres threads) mais l'UI est morte.

use tauri::command;
use windows::core::{Interface, PCWSTR};
use windows::Win32::Media::Audio::{
    eMultimedia, eRender, IAudioSessionControl, IAudioSessionControl2, IAudioSessionEnumerator,
    IAudioSessionManager2, IMMDeviceEnumerator, MMDeviceEnumerator,
};
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_ALL, COINIT_MULTITHREADED,
};

/// Assigne `name` comme nom d'affichage de la/les session(s) audio de ce process
/// sur le périphérique de rendu par défaut.
///
/// `spawn_blocking` : l'énumération des sessions audio interroge le service audio et
/// peut bloquer plusieurs centaines de millisecondes — jamais sur le thread principal.
#[command]
pub async fn set_audio_session_name(name: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let started = std::time::Instant::now();
        let r = unsafe { rename_sessions(&name) };
        let ms = started.elapsed().as_millis();
        // Cette énumération interroge le service audio pendant que mpv ouvre son flux
        // WASAPI. Tant qu'elle tournait sur le thread principal (commande non-async),
        // chacune de ces millisecondes était une milliseconde d'UI gelée.
        if ms >= 100 {
            eprintln!("[audio_session] ⚠ énumération lente : {ms} ms");
        } else {
            eprintln!("[audio_session] énumération : {ms} ms");
        }
        r
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

pub(crate) unsafe fn rename_sessions(name: &str) -> windows::core::Result<()> {
    // On ne libère COM que si c'est bien nous qui l'avons initialisé sur ce thread :
    // `CoUninitialize` ne doit être appelé qu'une fois par appel *réussi* (S_OK ou
    // S_FALSE). Sur un thread déjà en STA, `CoInitializeEx(MULTITHREADED)` renvoie
    // RPC_E_CHANGED_MODE sans incrémenter le compteur ; libérer quand même fermerait
    // la bibliothèque COM d'un thread qui ne nous appartient pas.
    let owned = CoInitializeEx(None, COINIT_MULTITHREADED).is_ok();
    let result = (|| -> windows::core::Result<()> {
        let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
        let device = enumerator.GetDefaultAudioEndpoint(eRender, eMultimedia)?;
        let manager: IAudioSessionManager2 = device.Activate(CLSCTX_ALL, None)?;
        let sessions: IAudioSessionEnumerator = manager.GetSessionEnumerator()?;
        let count = sessions.GetCount()?;
        let pid = std::process::id();
        let mut matched = 0;

        let mut wide: Vec<u16> = name.encode_utf16().collect();
        wide.push(0);

        for i in 0..count {
            let ctrl: IAudioSessionControl = sessions.GetSession(i)?;
            let ctrl2: IAudioSessionControl2 = ctrl.cast()?;
            // Ne renomme que les sessions appartenant à NOTRE process (mpv in-process).
            let spid = ctrl2.GetProcessId().unwrap_or(0);
            if spid == pid {
                matched += 1;
                match ctrl.SetDisplayName(PCWSTR(wide.as_ptr()), std::ptr::null()) {
                    Ok(_) => eprintln!("[audio_session] session pid={spid} renommée -> {name}"),
                    Err(e) => eprintln!("[audio_session] SetDisplayName échec: {e}"),
                }
            }
        }
        eprintln!("[audio_session] sessions={count} correspondant(pid={pid})={matched}");
        Ok(())
    })();
    if let Err(ref e) = result {
        eprintln!("[audio_session] erreur: {e}");
    }
    if owned {
        CoUninitialize();
    }
    result
}
