//! Sonde de détection de gel du thread UI (Windows, diagnostic).
//!
//! Quand la file d'entrée du thread UI est gelée par la fenêtre enfant de mpv (cf.
//! `mpv_window.rs`), l'app devient inutilisable : impossible d'y déclencher un
//! diagnostic à la main. La sonde tourne donc sur un **thread dédié**, hors de toute
//! file d'entrée, et interroge périodiquement l'état GUI du thread UI.
//!
//! Activation : variable d'environnement `TENTACLE_FREEZE_PROBE=1` (coût nul sinon).
//! Sortie : `%LOCALAPPDATA%\Tentacle TV\freeze-probe.log`, une ligne par transition
//! d'état — jamais en boucle.
//!
//! Lecture des résultats :
//!   - `GUI_INMOVESIZE`  → le thread fenêtre de mpv est dans la boucle modale de
//!                         déplacement/redimensionnement de `DefWindowProc` ;
//!   - `GUI_INMENUMODE`  → boucle de menu ;
//!   - `capture=0x…`     → capture souris orpheline (le thread propriétaire est logué).
//!
//! Si aucun de ces marqueurs n'apparaît pendant un gel, l'input est hors de cause et
//! il faut regarder du côté du rendu (`vo=gpu-next` / libplacebo / D3D11).

use std::fmt::Write as _;
use std::fs::OpenOptions;
use std::io::Write as _;
use std::path::PathBuf;
use std::thread::sleep;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use windows::Win32::Foundation::HWND;
use windows::Win32::UI::WindowsAndMessaging::{
    GetGUIThreadInfo, GetWindowThreadProcessId, GUITHREADINFO, GUI_INMENUMODE, GUI_INMOVESIZE,
};

const POLL_INTERVAL: Duration = Duration::from_millis(500);

fn log_path() -> Option<PathBuf> {
    let base = std::env::var_os("LOCALAPPDATA")?;
    let dir = PathBuf::from(base).join("Tentacle TV");
    std::fs::create_dir_all(&dir).ok()?;
    Some(dir.join("freeze-probe.log"))
}

fn append(path: &PathBuf, line: &str) {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(f, "[{secs}] {line}");
    }
}

/// Description compacte de l'état GUI, servant aussi de clé de transition : on
/// n'écrit une ligne que lorsque cette chaîne change.
fn snapshot(ui_thread_id: u32) -> String {
    let mut info = GUITHREADINFO {
        cbSize: std::mem::size_of::<GUITHREADINFO>() as u32,
        ..Default::default()
    };
    if unsafe { GetGUIThreadInfo(ui_thread_id, &mut info) }.is_err() {
        return "gui-thread-info-failed".to_string();
    }

    let mut s = String::new();
    if info.flags.0 & GUI_INMOVESIZE.0 != 0 {
        s.push_str("MODAL_MOVESIZE ");
    }
    if info.flags.0 & GUI_INMENUMODE.0 != 0 {
        s.push_str("MODAL_MENU ");
    }
    if !info.hwndCapture.is_invalid() {
        let owner = owner_thread(info.hwndCapture);
        let _ = write!(s, "capture={:?}(tid={owner}) ", info.hwndCapture.0);
    }
    if s.is_empty() {
        s.push_str("ok");
    }
    let _ = write!(
        s,
        "| active={:?} focus={:?}",
        info.hwndActive.0, info.hwndFocus.0
    );
    s
}

fn owner_thread(hwnd: HWND) -> u32 {
    unsafe { GetWindowThreadProcessId(hwnd, None) }
}

/// Démarre la sonde si `TENTACLE_FREEZE_PROBE=1`. À appeler depuis le thread UI
/// (celui qui exécutera la boucle d'évènements Tauri), dont on capture l'id.
pub fn spawn_if_enabled(ui_thread_id: u32) {
    if std::env::var("TENTACLE_FREEZE_PROBE").as_deref() != Ok("1") {
        return;
    }
    let Some(path) = log_path() else { return };

    std::thread::spawn(move || {
        append(&path, &format!("probe started, ui_thread_id={ui_thread_id}"));
        let mut last = String::new();
        loop {
            let now = snapshot(ui_thread_id);
            if now != last {
                append(&path, &now);
                last = now;
            }
            sleep(POLL_INTERVAL);
        }
    });
}
