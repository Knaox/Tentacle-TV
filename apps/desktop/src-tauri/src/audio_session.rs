//! Nomme explicitement la session audio WASAPI du process (mpv lit en
//! in-process) via `IAudioSessionControl::SetDisplayName`.
//!
//! Sans ça, Windows affiche un nom par défaut (« System Sounds ») dans le
//! mixeur de volume et les outils tiers (Stream Deck) ne ciblent pas l'app.
//! Microsoft impose d'assigner le nom sur la session une fois le 1er flux créé,
//! donc on appelle cette commande quand la lecture démarre.

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
#[command]
pub fn set_audio_session_name(name: String) -> Result<(), String> {
    unsafe { rename_sessions(&name) }.map_err(|e| e.to_string())
}

unsafe fn rename_sessions(name: &str) -> windows::core::Result<()> {
    let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
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
    CoUninitialize();
    result
}
