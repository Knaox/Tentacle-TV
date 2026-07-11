//! Inhibiteur d'idle Wayland — protocole `idle-inhibit-unstable-v1`.
//!
//! C'est la voie UNIVERSELLE sur Wayland : le compositeur (Hyprland, KWin,
//! Mutter, sway…) suspend sa détection d'inactivité (`ext-idle-notify`) tant
//! qu'un `zwp_idle_inhibitor_v1` est posé sur une surface visible. Ça couvre
//! les shells qui n'exposent AUCUNE interface D-Bus (ex. caelestia/Quickshell
//! sur Hyprland, dont l'IdleMonitor honore les inhibiteurs par défaut) — là où
//! ScreenSaver/SessionManager/logind ne suffisent pas pour l'écran/verrouillage.
//! Équivalent de la windowrule Hyprland `idleinhibit` appliquée aux jeux.
//!
//! FFI minimal sur libwayland-client (déjà liée par GTK) : les interfaces du
//! protocole (générées par wayland-scanner en C) ne sont PAS exportées par la
//! lib → on construit les `wl_interface` à la main (2 requêtes sans évènement).
//! Tout s'exécute sur le thread principal GTK (accès GDK) avec une file
//! d'évènements PRIVÉE : le `roundtrip` ne touche jamais la file de GDK.

use std::ffi::{c_char, c_int, c_void, CStr};
use std::ptr;
use std::sync::OnceLock;

use gtk::glib::translate::ToGlibPtr;
use gtk::prelude::*;

// ── ABI libwayland-client ──

#[repr(C)]
struct WlMessage {
    name: *const c_char,
    signature: *const c_char,
    types: *const *const WlInterface,
}

#[repr(C)]
struct WlInterface {
    name: *const c_char,
    version: c_int,
    method_count: c_int,
    methods: *const WlMessage,
    event_count: c_int,
    events: *const WlMessage,
}

// Les tables construites (statiques leakées) ne contiennent que des pointeurs
// vers des données 'static immuables.
struct InterfaceTables {
    manager: *const WlInterface,
    inhibitor: *const WlInterface,
}
unsafe impl Send for InterfaceTables {}
unsafe impl Sync for InterfaceTables {}

#[repr(C)]
struct RegistryListener {
    global: extern "C" fn(*mut c_void, *mut c_void, u32, *const c_char, u32),
    global_remove: extern "C" fn(*mut c_void, *mut c_void, u32),
}

// libwayland-client est déjà une dépendance runtime de GTK (backend Wayland),
// mais nos propres symboles exigent la lib sur la ligne du linker.
#[link(name = "wayland-client")]
extern "C" {
    // Interfaces coeur exportées par libwayland-client.
    static wl_registry_interface: WlInterface;
    static wl_surface_interface: WlInterface;

    fn wl_display_create_queue(display: *mut c_void) -> *mut c_void;
    fn wl_event_queue_destroy(queue: *mut c_void);
    fn wl_display_roundtrip_queue(display: *mut c_void, queue: *mut c_void) -> c_int;
    fn wl_display_flush(display: *mut c_void) -> c_int;
    fn wl_proxy_create_wrapper(proxy: *mut c_void) -> *mut c_void;
    fn wl_proxy_wrapper_destroy(proxy: *mut c_void);
    fn wl_proxy_set_queue(proxy: *mut c_void, queue: *mut c_void);
    fn wl_proxy_add_listener(
        proxy: *mut c_void,
        implementation: *const RegistryListener,
        data: *mut c_void,
    ) -> c_int;
    fn wl_proxy_marshal_constructor(
        proxy: *mut c_void,
        opcode: u32,
        interface: *const WlInterface,
        ...
    ) -> *mut c_void;
    fn wl_proxy_marshal_constructor_versioned(
        proxy: *mut c_void,
        opcode: u32,
        interface: *const WlInterface,
        version: u32,
        ...
    ) -> *mut c_void;
    fn wl_proxy_marshal(proxy: *mut c_void, opcode: u32, ...);
    fn wl_proxy_destroy(proxy: *mut c_void);

    // libgdk-3, backend Wayland (n'appeler QUE si le display est Wayland).
    fn gdk_wayland_display_get_wl_display(display: *mut c_void) -> *mut c_void;
    fn gdk_wayland_window_get_wl_surface(window: *mut c_void) -> *mut c_void;
}

// wl_display.get_registry = opcode 1 ; wl_registry.bind = opcode 0.
const WL_DISPLAY_GET_REGISTRY: u32 = 1;
const WL_REGISTRY_BIND: u32 = 0;
// zwp_idle_inhibit_manager_v1 : destroy = 0, create_inhibitor = 1.
const MANAGER_DESTROY: u32 = 0;
const MANAGER_CREATE_INHIBITOR: u32 = 1;
// zwp_idle_inhibitor_v1 : destroy = 0.
const INHIBITOR_DESTROY: u32 = 0;

const MANAGER_NAME: &CStr = c"zwp_idle_inhibit_manager_v1";

/// Construit (une fois, leaké) les `wl_interface` du protocole idle-inhibit.
fn interfaces() -> &'static InterfaceTables {
    static TABLES: OnceLock<InterfaceTables> = OnceLock::new();
    TABLES.get_or_init(|| {
        // zwp_idle_inhibitor_v1 : une requête `destroy` (sans argument).
        let inhibitor_methods: &'static [WlMessage] = Box::leak(Box::new([WlMessage {
            name: c"destroy".as_ptr(),
            signature: c"".as_ptr(),
            types: ptr::null(),
        }]));
        let inhibitor: &'static WlInterface = Box::leak(Box::new(WlInterface {
            name: c"zwp_idle_inhibitor_v1".as_ptr(),
            version: 1,
            method_count: 1,
            methods: inhibitor_methods.as_ptr(),
            event_count: 0,
            events: ptr::null(),
        }));

        // create_inhibitor(new_id zwp_idle_inhibitor_v1, wl_surface) : "no".
        let create_types: &'static [*const WlInterface] = Box::leak(Box::new([
            inhibitor as *const WlInterface,
            unsafe { &wl_surface_interface as *const WlInterface },
        ]));
        let manager_methods: &'static [WlMessage] = Box::leak(Box::new([
            WlMessage {
                name: c"destroy".as_ptr(),
                signature: c"".as_ptr(),
                types: ptr::null(),
            },
            WlMessage {
                name: c"create_inhibitor".as_ptr(),
                signature: c"no".as_ptr(),
                types: create_types.as_ptr(),
            },
        ]));
        let manager: &'static WlInterface = Box::leak(Box::new(WlInterface {
            name: MANAGER_NAME.as_ptr(),
            version: 1,
            method_count: 2,
            methods: manager_methods.as_ptr(),
            event_count: 0,
            events: ptr::null(),
        }));

        InterfaceTables { manager, inhibitor }
    })
}

/// Résultat du listener registry : name du global idle-inhibit s'il existe.
#[repr(C)]
struct FoundGlobal {
    name: u32,
    found: bool,
}

extern "C" fn on_global(
    data: *mut c_void,
    _registry: *mut c_void,
    name: u32,
    interface: *const c_char,
    _version: u32,
) {
    if interface.is_null() || data.is_null() {
        return;
    }
    let iface = unsafe { CStr::from_ptr(interface) };
    if iface == MANAGER_NAME {
        let found = unsafe { &mut *(data as *mut FoundGlobal) };
        found.name = name;
        found.found = true;
    }
}

extern "C" fn on_global_remove(_data: *mut c_void, _registry: *mut c_void, _name: u32) {}

static REGISTRY_LISTENER: RegistryListener = RegistryListener {
    global: on_global,
    global_remove: on_global_remove,
};

/// Objets Wayland tenus pendant l'inhibition (pointeurs opaques, thread GTK).
pub struct WaylandInhibitor {
    display: usize,
    queue: usize,
    wrapper: usize,
    registry: usize,
    manager: usize,
    inhibitor: usize,
}
// SAFETY: les pointeurs ne sont déréférencés que sur le thread principal GTK
// (create/release passent par run_on_main).
unsafe impl Send for WaylandInhibitor {}

/// Pose un inhibiteur d'idle sur la surface Wayland de la fenêtre `main`.
/// À appeler sur n'importe quel thread ; ne fait rien hors Wayland (X11 → les
/// inhibiteurs D-Bus/logind suffisent) ou si le compositeur n'a pas le protocole.
pub fn create(app: &tauri::AppHandle) -> Option<WaylandInhibitor> {
    use tauri::Manager;
    let window = app.get_webview_window("main")?;
    super::util::run_on_main(move || create_on_main(&window)).ok().flatten()
}

fn create_on_main(window: &tauri::WebviewWindow) -> Option<WaylandInhibitor> {
    let gtk_window = window.gtk_window().ok()?;
    create_for_gtk_window(gtk_window.upcast_ref::<gtk::Window>())
}

fn create_for_gtk_window(gtk_window: &gtk::Window) -> Option<WaylandInhibitor> {
    let display = gtk_window.display();
    // Backend Wayland uniquement — sur X11 les getters gdk_wayland_* sont invalides.
    if display.type_().name() != "GdkWaylandDisplay" {
        return None;
    }
    let gdk_window = gtk_window.window()?; // None si la fenêtre n'est pas réalisée

    // Pointeurs C des objets GDK (types explicites pour l'inférence glib).
    let display_c: *mut gtk::gdk::ffi::GdkDisplay = display.to_glib_none().0;
    let window_c: *mut gtk::gdk::ffi::GdkWindow = gdk_window.to_glib_none().0;

    unsafe {
        let display_ptr = gdk_wayland_display_get_wl_display(display_c as *mut c_void);
        let surface_ptr = gdk_wayland_window_get_wl_surface(window_c as *mut c_void);
        if display_ptr.is_null() || surface_ptr.is_null() {
            return None;
        }

        // File privée : notre roundtrip ne dispatch jamais les évènements GDK.
        let queue = wl_display_create_queue(display_ptr);
        if queue.is_null() {
            return None;
        }
        let wrapper = wl_proxy_create_wrapper(display_ptr);
        if wrapper.is_null() {
            wl_event_queue_destroy(queue);
            return None;
        }
        wl_proxy_set_queue(wrapper, queue);

        let registry = wl_proxy_marshal_constructor(
            wrapper,
            WL_DISPLAY_GET_REGISTRY,
            &wl_registry_interface,
            ptr::null::<c_void>(),
        );
        if registry.is_null() {
            wl_proxy_wrapper_destroy(wrapper);
            wl_event_queue_destroy(queue);
            return None;
        }

        let mut found = FoundGlobal { name: 0, found: false };
        wl_proxy_add_listener(registry, &REGISTRY_LISTENER, &mut found as *mut _ as *mut c_void);
        // Roundtrip sur NOTRE file : traite uniquement les évènements du registry.
        wl_display_roundtrip_queue(display_ptr, queue);

        let cleanup = |registry: *mut c_void, wrapper: *mut c_void, queue: *mut c_void| {
            wl_proxy_destroy(registry);
            wl_proxy_wrapper_destroy(wrapper);
            wl_event_queue_destroy(queue);
        };

        if !found.found {
            // Compositeur sans idle-inhibit (rare) — abandon silencieux.
            cleanup(registry, wrapper, queue);
            return None;
        }

        let tables = interfaces();
        let manager = wl_proxy_marshal_constructor_versioned(
            registry,
            WL_REGISTRY_BIND,
            tables.manager,
            1,
            found.name,
            MANAGER_NAME.as_ptr(),
            1u32,
            ptr::null::<c_void>(),
        );
        if manager.is_null() {
            cleanup(registry, wrapper, queue);
            return None;
        }

        let inhibitor = wl_proxy_marshal_constructor(
            manager,
            MANAGER_CREATE_INHIBITOR,
            tables.inhibitor,
            ptr::null::<c_void>(),
            surface_ptr,
        );
        if inhibitor.is_null() {
            wl_proxy_marshal(manager, MANAGER_DESTROY);
            wl_proxy_destroy(manager);
            cleanup(registry, wrapper, queue);
            return None;
        }
        wl_display_flush(display_ptr);

        Some(WaylandInhibitor {
            display: display_ptr as usize,
            queue: queue as usize,
            wrapper: wrapper as usize,
            registry: registry as usize,
            manager: manager as usize,
            inhibitor: inhibitor as usize,
        })
    }
}

/// Libère l'inhibiteur (le compositeur reprend sa détection d'inactivité).
pub fn release(held: WaylandInhibitor) {
    let _ = super::util::run_on_main(move || unsafe {
        wl_proxy_marshal(held.inhibitor as *mut c_void, INHIBITOR_DESTROY);
        wl_proxy_destroy(held.inhibitor as *mut c_void);
        wl_proxy_marshal(held.manager as *mut c_void, MANAGER_DESTROY);
        wl_proxy_destroy(held.manager as *mut c_void);
        wl_proxy_destroy(held.registry as *mut c_void);
        wl_proxy_wrapper_destroy(held.wrapper as *mut c_void);
        wl_event_queue_destroy(held.queue as *mut c_void);
        wl_display_flush(held.display as *mut c_void);
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command;

    /// De bout en bout contre le compositeur réel : l'inhibiteur posé sur une
    /// fenêtre GTK est visible dans `hyprctl clients` (`inhibitingIdle: true`)
    /// puis disparaît à la libération. Sans session Wayland/Hyprland (CI), le
    /// test passe sans rien vérifier.
    #[test]
    fn inhibiteur_wayland_pose_et_libere() {
        if std::env::var_os("WAYLAND_DISPLAY").is_none() || gtk::init().is_err() {
            return;
        }
        let win = gtk::Window::new(gtk::WindowType::Toplevel);
        win.set_title("tentacle-idle-inhibit-test");
        win.set_default_size(60, 40);
        win.show_all();
        // Laisser GTK mapper la fenêtre (la surface doit exister et être visible).
        for _ in 0..100 {
            gtk::main_iteration_do(false);
        }

        let Some(held) = create_for_gtk_window(&win) else {
            // Compositeur sans idle-inhibit — rien à vérifier.
            return;
        };
        // Laisser le compositeur digérer la requête.
        for _ in 0..50 {
            gtk::main_iteration_do(false);
        }
        std::thread::sleep(std::time::Duration::from_millis(150));

        if let Some(inhibiting) = hyprctl_inhibiting("tentacle-idle-inhibit-test") {
            assert!(inhibiting, "hyprctl devrait voir inhibitingIdle=true");
        }

        release(held);
        for _ in 0..50 {
            gtk::main_iteration_do(false);
        }
        std::thread::sleep(std::time::Duration::from_millis(150));
        if let Some(inhibiting) = hyprctl_inhibiting("tentacle-idle-inhibit-test") {
            assert!(!inhibiting, "hyprctl devrait voir inhibitingIdle=false après release");
        }
        win.close();
    }

    /// `inhibitingIdle` du client hyprctl dont le titre correspond, si Hyprland
    /// est disponible (None sinon → vérification sautée).
    fn hyprctl_inhibiting(title: &str) -> Option<bool> {
        let out = Command::new("hyprctl").args(["clients", "-j"]).output().ok()?;
        if !out.status.success() {
            return None;
        }
        let clients: serde_json::Value = serde_json::from_slice(&out.stdout).ok()?;
        clients
            .as_array()?
            .iter()
            .find(|c| c["title"].as_str() == Some(title))?
            .get("inhibitingIdle")?
            .as_bool()
    }
}
