//! Sonde de diagnostic des gels du lecteur (Windows).
//!
//! Symptôme visé : le film continue (son + image), mais l'app ne répond plus à aucun
//! clic ni aucune touche. Deux causes possibles, qui appellent des correctifs opposés
//! et que rien ne distingue à l'œil nu :
//!
//!   (A) le thread UI tourne et pompe ses messages, mais la **file d'entrée** qu'il
//!       partage avec le thread fenêtre de mpv (fenêtre `WS_CHILD` créée par un autre
//!       thread ⇒ files attachées) est bloquée. L'app est vivante, sourde ;
//!   (B) le **thread UI lui-même** est bloqué (appel croisé vers le thread de mpv) ou
//!       affamé (flot d'évènements mpv → un `eval` WebView2 par changement de propriété).
//!
//! La sonde tourne sur un thread dédié, hors de toute file d'entrée, et envoie un
//! `WM_NULL` chronométré à chacune des deux fenêtres. Celle dont le thread ne répond
//! plus est le coupable :
//!
//!   `ui=HUNG mpv=ok`   → (B) le thread UI est bloqué/affamé.
//!   `ui=ok mpv=HUNG`   → le thread fenêtre de mpv est bloqué ; s'il gèle aussi les
//!                        entrées, c'est (A) via l'attachement des files.
//!   `ui=ok mpv=ok` + `MODAL_MOVESIZE` ou `capture=…`
//!                      → (A) : boucle modale ou capture souris orpheline.
//!   `ui=ok mpv=ok` sans marqueur pendant un gel
//!                      → l'input et l'UI sont hors de cause : chercher côté rendu.
//!
//! **Active par défaut**, y compris en production, parce que ce gel n'est pas un crash :
//! le processus survit, aucune exception n'est levée, Windows n'écrit aucun rapport
//! d'erreur. Sans détecteur, il ne laisse strictement aucune trace.
//!
//! Le coût est un thread qui envoie deux `WM_NULL` toutes les 500 ms. En fonctionnement
//! normal, **une seule ligne est écrite au démarrage** puis plus rien : le journal ne
//! grossit qu'en cas d'anomalie. `dbghelp` n'est chargé que si un gel survient réellement.
//! Coupure : `TENTACLE_FREEZE_PROBE=0`.
//!
//! **Déclencheur manuel** : quand l'app est figée, plus rien ne répond — ni raccourci, ni
//! devtools. Créer le fichier `%LOCALAPPDATA%\Tentacle TV\dump-now` depuis n'importe
//! quelle autre fenêtre (Explorateur, PowerShell) fait vidanger, sous 500 ms, la pile de
//! **tous** les threads dans le log. La sonde supprime ensuite le fichier.
//!
//! Sortie : `%LOCALAPPDATA%\Tentacle TV\freeze-probe.log`, une ligne par transition.

use std::ffi::c_void;
use std::fmt::Write as _;
use std::fs::OpenOptions;
use std::io::Write as _;
use std::path::PathBuf;
use std::thread::sleep;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use windows::core::w;
use windows::Win32::Foundation::{HWND, LPARAM, WPARAM};
use windows::Win32::UI::WindowsAndMessaging::{
    FindWindowExW, GetGUIThreadInfo, GetWindowThreadProcessId, IsHungAppWindow, SendMessageTimeoutW,
    GUITHREADINFO, GUI_INMENUMODE, GUI_INMOVESIZE, SMTO_ABORTIFHUNG, SMTO_NORMAL, WM_NULL,
};

const POLL_INTERVAL: Duration = Duration::from_millis(500);
/// Au-delà, on considère le thread propriétaire de la fenêtre comme non-réactif.
const HEARTBEAT_TIMEOUT_MS: u32 = 300;
/// Latence de réponse à partir de laquelle on parle de saturation plutôt que de blocage.
const SLOW_THRESHOLD: Duration = Duration::from_millis(50);
/// Un journal de diagnostic chez un utilisateur ne doit jamais croître sans borne.
const MAX_LOG_BYTES: u64 = 2 * 1024 * 1024;

fn data_dir() -> Option<PathBuf> {
    let base = std::env::var_os("LOCALAPPDATA")?;
    let dir = PathBuf::from(base).join("Tentacle TV");
    std::fs::create_dir_all(&dir).ok()?;
    Some(dir)
}

/// Écrit une ligne dans le journal de la sonde depuis n'importe où. Utilisé par
/// `debug_mark` pour corréler les cycles du banc de torture avec les piles capturées ;
/// n'existe donc pas dans les builds livrés.
#[cfg(debug_assertions)]
pub fn log_line(msg: &str) {
    if let Some(dir) = data_dir() {
        append(&dir.join("freeze-probe.log"), msg);
    }
}

/// Repart d'un fichier neuf au-delà de `MAX_LOG_BYTES`, en conservant le précédent :
/// un gel survient rarement deux fois de suite, l'avant-dernier journal a de la valeur.
fn rotate_if_needed(path: &PathBuf) {
    let too_big = std::fs::metadata(path).map(|m| m.len() > MAX_LOG_BYTES).unwrap_or(false);
    if too_big {
        let _ = std::fs::rename(path, path.with_extension("log.1"));
    }
}

fn append(path: &PathBuf, line: &str) {
    rotate_if_needed(path);
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(f, "[{secs}] {line}");
    }
}

/// Envoie un `WM_NULL` à `hwnd` et mesure le temps de réponse du thread qui la possède.
/// `None` = le thread ne pompe plus (timeout, ou déjà marqué « hung » par le système).
fn heartbeat(hwnd: HWND) -> Option<Duration> {
    let start = Instant::now();
    let mut out: usize = 0;
    let r = unsafe {
        SendMessageTimeoutW(
            hwnd,
            WM_NULL,
            WPARAM(0),
            LPARAM(0),
            SMTO_NORMAL | SMTO_ABORTIFHUNG,
            HEARTBEAT_TIMEOUT_MS,
            Some(&mut out),
        )
    };
    (r.0 != 0).then(|| start.elapsed())
}

/// `ok(3ms)` / `SLOW(180ms)` / `HUNG` — bucketisé pour servir de clé de transition.
fn health(hwnd: HWND) -> String {
    match heartbeat(hwnd) {
        None => "HUNG".to_string(),
        Some(d) if d >= SLOW_THRESHOLD => format!("SLOW({}ms)", d.as_millis()),
        Some(d) => format!("ok({}ms)", d.as_millis()),
    }
}

fn owner_thread(hwnd: HWND) -> u32 {
    unsafe { GetWindowThreadProcessId(hwnd, None) }
}

/// Fenêtre vidéo de mpv : classe `MPV_WINDOW_CLASS_NAME` (= L"mpv"), enfant du
/// HWND top-level. Absente tant qu'aucune lecture n'a démarré.
fn mpv_child(parent: HWND) -> Option<HWND> {
    unsafe { FindWindowExW(Some(parent), None, w!("mpv"), None) }
        .ok()
        .filter(|h| !h.is_invalid())
}

fn snapshot(top: HWND, ui_thread_id: u32) -> String {
    let mut s = String::new();

    let _ = write!(s, "ui={}", health(top));
    if unsafe { IsHungAppWindow(top) }.as_bool() {
        s.push_str(" IS_HUNG_APP");
    }

    match mpv_child(top) {
        Some(child) => {
            let _ = write!(
                s,
                " mpv={}(tid={})",
                health(child),
                owner_thread(child)
            );
        }
        None => s.push_str(" mpv=absent"),
    }

    let mut info = GUITHREADINFO {
        cbSize: std::mem::size_of::<GUITHREADINFO>() as u32,
        ..Default::default()
    };
    if unsafe { GetGUIThreadInfo(ui_thread_id, &mut info) }.is_ok() {
        if info.flags.0 & GUI_INMOVESIZE.0 != 0 {
            s.push_str(" MODAL_MOVESIZE");
        }
        if info.flags.0 & GUI_INMENUMODE.0 != 0 {
            s.push_str(" MODAL_MENU");
        }
        if !info.hwndCapture.is_invalid() {
            let _ = write!(
                s,
                " capture={:?}(tid={})",
                info.hwndCapture.0,
                owner_thread(info.hwndCapture)
            );
        }
    } else {
        s.push_str(" gui-thread-info-failed");
    }
    s
}

/// Démarre la sonde si `TENTACLE_FREEZE_PROBE=1`. À appeler depuis le `setup()` de
/// Tauri, c'est-à-dire sur le thread qui exécutera la boucle d'évènements.
pub fn spawn_if_enabled(top: isize, ui_thread_id: u32) {
    if std::env::var("TENTACLE_FREEZE_PROBE").as_deref() == Ok("0") {
        return;
    }
    let Some(dir) = data_dir() else { return };
    let path = dir.join("freeze-probe.log");
    let trigger = dir.join("dump-now");
    // Un déclencheur laissé d'une session précédente ne doit pas dumper au démarrage.
    let _ = std::fs::remove_file(&trigger);
    eprintln!("[freeze-probe] journal : {}", path.display());
    eprintln!("[freeze-probe] pour dumper les piles à la demande : créer {}", trigger.display());

    std::thread::spawn(move || {
        let top = HWND(top as *mut c_void);
        // `dbghelp` n'est pas chargé ici : `capture_all_threads` s'en charge paresseusement,
        // au premier gel. En marche normale, l'app ne paie donc rien.
        append(&path, &format!("--- sonde démarrée, thread principal tid={ui_thread_id} ---"));

        let mut last = String::new();
        let mut dumped = false;
        loop {
            // Déclencheur manuel : marche même quand l'app ne reçoit plus aucune entrée.
            if trigger.exists() {
                let _ = std::fs::remove_file(&trigger);
                append(&path, "=== dump manuel demandé ===");
                append(&path, &snapshot(top, ui_thread_id));
                dump_all(&path, ui_thread_id);
            }

            let now = snapshot(top, ui_thread_id);
            if now != last {
                append(&path, &now);

                // Le thread UI vient de cesser de répondre. Une seule vidange par épisode,
                // pour ne pas noyer le journal.
                if now.contains("ui=HUNG") && !dumped {
                    append(&path, "=== thread principal non réactif ===");
                    dump_all(&path, ui_thread_id);
                    dumped = true;
                } else if !now.contains("ui=HUNG") {
                    dumped = false;
                }
                last = now;
            }
            sleep(POLL_INTERVAL);
        }
    });
}

/// En release, `windows_subsystem = "windows"` supprime stderr : une panique Rust ne laisse
/// aucune trace. On la consigne dans le même journal, avec le fichier et la ligne.
pub fn install_panic_logger() {
    let previous = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        if let Some(dir) = data_dir() {
            let where_ = info
                .location()
                .map(|l| format!("{}:{}", l.file(), l.line()))
                .unwrap_or_else(|| "?".to_string());
            let msg = info
                .payload()
                .downcast_ref::<&str>()
                .map(|s| s.to_string())
                .or_else(|| info.payload().downcast_ref::<String>().cloned())
                .unwrap_or_else(|| "(charge utile non textuelle)".to_string());
            append(
                &dir.join("freeze-probe.log"),
                &format!("!!! PANIQUE à {where_} : {msg}"),
            );
        }
        previous(info);
    }));
}

fn dump_all(path: &PathBuf, ui_thread_id: u32) {
    for line in crate::win_stack::capture_all_threads(ui_thread_id) {
        append(path, &line);
    }
    append(path, "=== fin du dump ===");
}
