//! Anti-veille Linux — inhibiteurs D-Bus pendant la lecture vidéo.
//!
//! Avec le Render API (GtkGLArea), mpv n'a AUCUNE fenêtre native : son option
//! `stop-screensaver` est inopérante (elle suppose une fenêtre X11/Wayland que
//! mpv possède). Sans inhibiteur, l'écran s'éteint et la machine part en veille
//! en pleine lecture. Miroir Linux de `macos/sleep_assertion.rs` : mêmes
//! commandes Tauri (`prevent_display_sleep_start`/`stop`), pilotées par le
//! frontend (start au play, stop au pause/stop/démontage — `useMpvCommands`).
//!
//! Tous les backends qui répondent sont retenus (cumulables) :
//! - bus session : `org.freedesktop.ScreenSaver` (KDE, GNOME, hypridle…),
//!   `org.gnome.SessionManager` (GNOME), `org.freedesktop.PowerManagement`
//!   (KDE/XFCE) — inhibition idle/extinction d'écran.
//! - bus système : `org.freedesktop.login1` — `Inhibit("idle:sleep", …,
//!   "block")` renvoie un fd à garder ouvert ; bloque `systemctl suspend` et
//!   l'IdleAction logind même sans daemon d'idle de bureau (ex. Hyprland nu).
//!
//! Les appels D-Bus sont synchrones (timeout court + NO_AUTO_START : un service
//! absent échoue immédiatement sans être lancé) et thread-safe (GDBus), donc
//! utilisables depuis le runtime async de Tauri sans toucher au thread GTK.

use std::os::fd::{FromRawFd, OwnedFd};
use std::sync::Mutex;

use gtk::{gio, glib};
use gtk::gio::prelude::*;
use tauri::{command, State};

const APP_NAME: &str = "Tentacle TV";
const REASON: &str = "Lecture vidéo en cours";
const DBUS_TIMEOUT_MS: i32 = 2000;

// org.gnome.SessionManager.Inhibit : 4 = suspend, 8 = idle.
const GNOME_FLAGS_SUSPEND_IDLE: u32 = 4 | 8;

/// Interface d'inhibition sur le bus session : Inhibit(...) → cookie u32.
struct SessionTarget {
    dest: &'static str,
    path: &'static str,
    iface: &'static str,
    uninhibit: &'static str,
}

const SESSION_TARGETS: [SessionTarget; 3] = [
    SessionTarget {
        dest: "org.freedesktop.ScreenSaver",
        path: "/org/freedesktop/ScreenSaver",
        iface: "org.freedesktop.ScreenSaver",
        uninhibit: "UnInhibit",
    },
    SessionTarget {
        dest: "org.gnome.SessionManager",
        path: "/org/gnome/SessionManager",
        iface: "org.gnome.SessionManager",
        uninhibit: "Uninhibit",
    },
    SessionTarget {
        dest: "org.freedesktop.PowerManagement",
        path: "/org/freedesktop/PowerManagement/Inhibit",
        iface: "org.freedesktop.PowerManagement.Inhibit",
        uninhibit: "UnInhibit",
    },
];

/// Inhibiteur actif, à libérer au stop.
enum Held {
    /// Cookie d'un service session (index dans `SESSION_TARGETS`).
    Session { target: usize, cookie: u32 },
    /// Fd logind — le fermer (drop) libère l'inhibition côté systemd.
    LogindFd(#[allow(dead_code)] OwnedFd),
}

pub struct SleepInhibit {
    held: Mutex<Vec<Held>>,
}

impl SleepInhibit {
    pub fn new() -> Self {
        Self { held: Mutex::new(Vec::new()) }
    }
}

/// Paramètres d'Inhibit propres à chaque service (signatures différentes).
fn session_params(target: usize) -> glib::Variant {
    match target {
        // org.gnome.SessionManager.Inhibit(app_id s, toplevel_xid u, reason s, flags u)
        1 => (APP_NAME, 0u32, REASON, GNOME_FLAGS_SUSPEND_IDLE).to_variant(),
        // fdo ScreenSaver / PowerManagement : Inhibit(app s, reason s)
        _ => (APP_NAME, REASON).to_variant(),
    }
}

fn inhibit_session(conn: &gio::DBusConnection, target: usize) -> Option<Held> {
    let t = &SESSION_TARGETS[target];
    let ret = conn
        .call_sync(
            Some(t.dest),
            t.path,
            t.iface,
            "Inhibit",
            Some(&session_params(target)),
            Some(glib::VariantTy::new("(u)").ok()?),
            gio::DBusCallFlags::NO_AUTO_START,
            DBUS_TIMEOUT_MS,
            gio::Cancellable::NONE,
        )
        .ok()?;
    let cookie = ret.child_value(0).get::<u32>()?;
    Some(Held::Session { target, cookie })
}

fn inhibit_logind(conn: &gio::DBusConnection) -> Option<Held> {
    let (_, fd_list) = conn
        .call_with_unix_fd_list_sync(
            Some("org.freedesktop.login1"),
            "/org/freedesktop/login1",
            "org.freedesktop.login1.Manager",
            "Inhibit",
            Some(&("idle:sleep", APP_NAME, REASON, "block").to_variant()),
            Some(glib::VariantTy::new("(h)").ok()?),
            gio::DBusCallFlags::NO_AUTO_START,
            DBUS_TIMEOUT_MS,
            gio::UnixFDList::NONE,
            gio::Cancellable::NONE,
        )
        .ok()?;
    // Un seul fd renvoyé par Inhibit — on en prend possession (drop = release).
    let fds = fd_list.steal_fds();
    let fd = *fds.first()?;
    if fd < 0 {
        return None;
    }
    Some(Held::LogindFd(unsafe { OwnedFd::from_raw_fd(fd) }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command;

    /// L'inhibiteur logind est réellement posé (visible dans
    /// `systemd-inhibit --list`) puis libéré au drop du fd. Sans bus système
    /// (conteneur CI), le test passe sans rien vérifier.
    #[test]
    fn logind_inhibit_pose_et_libere() {
        let Ok(conn) = gio::bus_get_sync(gio::BusType::System, gio::Cancellable::NONE) else {
            return;
        };
        let Some(held) = inhibit_logind(&conn) else { return };
        if let Ok(out) = Command::new("systemd-inhibit").arg("--list").output() {
            let list = String::from_utf8_lossy(&out.stdout).to_string();
            assert!(
                list.contains(APP_NAME),
                "inhibiteur absent de systemd-inhibit --list :\n{list}"
            );
        }
        drop(held);
    }
}

#[command]
pub async fn prevent_display_sleep_start(state: State<'_, SleepInhibit>) -> Result<(), String> {
    let mut guard = state.held.lock().map_err(|e| e.to_string())?;
    if !guard.is_empty() {
        return Ok(());
    }

    let mut held: Vec<Held> = Vec::new();
    if let Ok(conn) = gio::bus_get_sync(gio::BusType::Session, gio::Cancellable::NONE) {
        for target in 0..SESSION_TARGETS.len() {
            if let Some(h) = inhibit_session(&conn, target) {
                held.push(h);
            }
        }
    }
    if let Ok(conn) = gio::bus_get_sync(gio::BusType::System, gio::Cancellable::NONE) {
        if let Some(h) = inhibit_logind(&conn) {
            held.push(h);
        }
    }

    if held.is_empty() {
        return Err(
            "Anti-veille indisponible : aucun service D-Bus n'a répondu \
             (ScreenSaver/SessionManager/PowerManagement/logind)"
                .to_string(),
        );
    }
    *guard = held;
    Ok(())
}

#[command]
pub async fn prevent_display_sleep_stop(state: State<'_, SleepInhibit>) -> Result<(), String> {
    let held = {
        let mut guard = state.held.lock().map_err(|e| e.to_string())?;
        std::mem::take(&mut *guard)
    };
    if held.is_empty() {
        return Ok(());
    }

    let conn = gio::bus_get_sync(gio::BusType::Session, gio::Cancellable::NONE).ok();
    for h in held {
        match h {
            Held::Session { target, cookie } => {
                if let Some(conn) = &conn {
                    let t = &SESSION_TARGETS[target];
                    let _ = conn.call_sync(
                        Some(t.dest),
                        t.path,
                        t.iface,
                        t.uninhibit,
                        Some(&glib::Variant::tuple_from_iter([cookie.to_variant()])),
                        None,
                        gio::DBusCallFlags::NO_AUTO_START,
                        DBUS_TIMEOUT_MS,
                        gio::Cancellable::NONE,
                    );
                }
            }
            // Drop du fd → logind libère l'inhibition.
            Held::LogindFd(_) => {}
        }
    }
    Ok(())
}
