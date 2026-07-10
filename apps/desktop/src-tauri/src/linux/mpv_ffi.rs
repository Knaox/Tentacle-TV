//! Liaison FFI vers libmpv (client + Render API OpenGL) pour Linux.
//!
//! Structures et pointeurs de fonctions **identiques** au module macOS
//! (`src/macos/mpv_ffi.rs`) — l'ABI de libmpv est indépendante de la plateforme.
//! Seul `find_lib_path` diffère : on charge `libmpv.so.2` via le linker système
//! (paquets `libmpv2`/`mpv-libs`), avec repli sur les emplacements multiarch et
//! sur une éventuelle copie embarquée (AppImage).

use std::ffi::{c_char, c_int, c_void};
use std::path::PathBuf;

// --- mpv format constants ---
pub const MPV_FORMAT_NONE: c_int = 0;
pub const MPV_FORMAT_STRING: c_int = 1;
pub const MPV_FORMAT_FLAG: c_int = 3;
pub const MPV_FORMAT_INT64: c_int = 4;
pub const MPV_FORMAT_DOUBLE: c_int = 5;

// --- mpv event IDs ---
pub const MPV_EVENT_NONE: u32 = 0;
pub const MPV_EVENT_SHUTDOWN: u32 = 1;
pub const MPV_EVENT_END_FILE: u32 = 7;
pub const MPV_EVENT_FILE_LOADED: u32 = 8;
pub const MPV_EVENT_IDLE: u32 = 11;
pub const MPV_EVENT_PLAYBACK_RESTART: u32 = 21;
pub const MPV_EVENT_PROPERTY_CHANGE: u32 = 22;

// --- mpv end-file reasons ---
pub const MPV_END_FILE_REASON_EOF: c_int = 0;
pub const MPV_END_FILE_REASON_STOP: c_int = 2;
pub const MPV_END_FILE_REASON_QUIT: c_int = 3;
pub const MPV_END_FILE_REASON_ERROR: c_int = 4;
pub const MPV_END_FILE_REASON_REDIRECT: c_int = 5;

// --- mpv render param types ---
pub const MPV_RENDER_PARAM_INVALID: c_int = 0;
pub const MPV_RENDER_PARAM_API_TYPE: c_int = 1;
pub const MPV_RENDER_PARAM_OPENGL_INIT_PARAMS: c_int = 2;
pub const MPV_RENDER_PARAM_OPENGL_FBO: c_int = 3;
pub const MPV_RENDER_PARAM_FLIP_Y: c_int = 4;
pub const MPV_RENDER_PARAM_BLOCK_FOR_TARGET_TIME: c_int = 8;

// --- FFI structs ---
#[repr(C)]
pub struct MpvEventStruct {
    pub event_id: u32,
    pub error: c_int,
    pub reply_userdata: u64,
    pub data: *mut c_void,
}

#[repr(C)]
pub struct MpvEventProperty {
    pub name: *const c_char,
    pub format: c_int,
    pub data: *mut c_void,
}

#[repr(C)]
pub struct MpvEventEndFile {
    pub reason: c_int,
    pub error: c_int,
    pub playlist_entry_id: i64,
    pub playlist_insert_id: i64,
    pub playlist_insert_num_entries: c_int,
}

#[repr(C)]
pub struct MpvOpenGLInitParams {
    pub get_proc_address: Option<unsafe extern "C" fn(*mut c_void, *const c_char) -> *mut c_void>,
    pub get_proc_address_ctx: *mut c_void,
}

#[repr(C)]
pub struct MpvOpenGLFbo {
    pub fbo: c_int,
    pub w: c_int,
    pub h: c_int,
    pub internal_format: c_int,
}

#[repr(C)]
pub struct MpvRenderParam {
    pub type_: c_int,
    pub data: *mut c_void,
}

// --- Type aliases for function pointers ---
type MpvCreateFn = unsafe extern "C" fn() -> *mut c_void;
type MpvInitializeFn = unsafe extern "C" fn(*mut c_void) -> c_int;
type MpvDestroyFn = unsafe extern "C" fn(*mut c_void);
type MpvSetOptionStringFn = unsafe extern "C" fn(*mut c_void, *const c_char, *const c_char) -> c_int;
type MpvCommandStringFn = unsafe extern "C" fn(*mut c_void, *const c_char) -> c_int;
type MpvSetPropertyStringFn = unsafe extern "C" fn(*mut c_void, *const c_char, *const c_char) -> c_int;
type MpvGetPropertyStringFn = unsafe extern "C" fn(*mut c_void, *const c_char) -> *mut c_char;
type MpvGetPropertyFn = unsafe extern "C" fn(*mut c_void, *const c_char, c_int, *mut c_void) -> c_int;
type MpvFreeFn = unsafe extern "C" fn(*mut c_void);
type MpvObservePropertyFn = unsafe extern "C" fn(*mut c_void, u64, *const c_char, c_int) -> c_int;
type MpvWaitEventFn = unsafe extern "C" fn(*mut c_void, f64) -> *mut MpvEventStruct;
type MpvRenderContextCreateFn = unsafe extern "C" fn(*mut *mut c_void, *mut c_void, *mut MpvRenderParam) -> c_int;
type MpvRenderContextSetUpdateCallbackFn = unsafe extern "C" fn(*mut c_void, Option<unsafe extern "C" fn(*mut c_void)>, *mut c_void);
type MpvRenderContextRenderFn = unsafe extern "C" fn(*mut c_void, *mut MpvRenderParam) -> c_int;
type MpvRenderContextFreeFn = unsafe extern "C" fn(*mut c_void);
type MpvRenderContextReportSwapFn = unsafe extern "C" fn(*mut c_void);

pub struct MpvLib {
    _lib: libloading::Library,
    pub create: MpvCreateFn,
    pub initialize: MpvInitializeFn,
    pub destroy: MpvDestroyFn,
    pub set_option_string: MpvSetOptionStringFn,
    pub command_string: MpvCommandStringFn,
    pub set_property_string: MpvSetPropertyStringFn,
    pub get_property_string: MpvGetPropertyStringFn,
    pub get_property: MpvGetPropertyFn,
    pub free: MpvFreeFn,
    pub observe_property: MpvObservePropertyFn,
    pub wait_event: MpvWaitEventFn,
    pub render_context_create: MpvRenderContextCreateFn,
    pub render_context_set_update_callback: MpvRenderContextSetUpdateCallbackFn,
    pub render_context_render: MpvRenderContextRenderFn,
    pub render_context_free: MpvRenderContextFreeFn,
    pub render_context_report_swap: MpvRenderContextReportSwapFn,
}

// SAFETY: MpvLib only stores function pointers and a library handle.
// All mpv calls are serialized through Mutex<*mut c_void> in RenderState.
unsafe impl Send for MpvLib {}
unsafe impl Sync for MpvLib {}

impl MpvLib {
    pub fn load() -> Result<Self, String> {
        let lib = Self::open_lib()?;
        unsafe {
            macro_rules! sym {
                ($name:expr, $ty:ty) => {{
                    let raw: *mut c_void = *lib.get::<*mut c_void>($name)
                        .map_err(|e| format!("Symbol {} not found: {e}", String::from_utf8_lossy($name)))?;
                    std::mem::transmute::<*mut c_void, $ty>(raw)
                }};
            }

            Ok(Self {
                create: sym!(b"mpv_create\0", MpvCreateFn),
                initialize: sym!(b"mpv_initialize\0", MpvInitializeFn),
                destroy: sym!(b"mpv_destroy\0", MpvDestroyFn),
                set_option_string: sym!(b"mpv_set_option_string\0", MpvSetOptionStringFn),
                command_string: sym!(b"mpv_command_string\0", MpvCommandStringFn),
                set_property_string: sym!(b"mpv_set_property_string\0", MpvSetPropertyStringFn),
                get_property_string: sym!(b"mpv_get_property_string\0", MpvGetPropertyStringFn),
                get_property: sym!(b"mpv_get_property\0", MpvGetPropertyFn),
                free: sym!(b"mpv_free\0", MpvFreeFn),
                observe_property: sym!(b"mpv_observe_property\0", MpvObservePropertyFn),
                wait_event: sym!(b"mpv_wait_event\0", MpvWaitEventFn),
                render_context_create: sym!(b"mpv_render_context_create\0", MpvRenderContextCreateFn),
                render_context_set_update_callback: sym!(b"mpv_render_context_set_update_callback\0", MpvRenderContextSetUpdateCallbackFn),
                render_context_render: sym!(b"mpv_render_context_render\0", MpvRenderContextRenderFn),
                render_context_free: sym!(b"mpv_render_context_free\0", MpvRenderContextFreeFn),
                render_context_report_swap: sym!(b"mpv_render_context_report_swap\0", MpvRenderContextReportSwapFn),
                _lib: lib,
            })
        }
    }

    /// Ouvre libmpv : d'abord par soname (résolu par le linker → couvre Arch
    /// `/usr/lib`, Debian multiarch, Fedora `/usr/lib64`), puis chemins explicites
    /// et copie embarquée à côté de l'exécutable (AppImage).
    fn open_lib() -> Result<libloading::Library, String> {
        let mut candidates: Vec<PathBuf> = vec![
            PathBuf::from("libmpv.so.2"),
            PathBuf::from("libmpv.so"),
        ];
        if let Ok(exe) = std::env::current_exe() {
            if let Some(dir) = exe.parent() {
                candidates.push(dir.join("lib/libmpv.so.2"));
                candidates.push(dir.join("../lib/libmpv.so.2"));
            }
        }
        candidates.push(PathBuf::from("/usr/lib/libmpv.so.2"));
        candidates.push(PathBuf::from("/usr/lib/x86_64-linux-gnu/libmpv.so.2"));
        candidates.push(PathBuf::from("/usr/lib64/libmpv.so.2"));

        let mut last_err = String::from("no candidate paths");
        for path in &candidates {
            match unsafe { libloading::Library::new(path) } {
                Ok(lib) => return Ok(lib),
                Err(e) => last_err = format!("{}: {e}", path.display()),
            }
        }
        Err(format!("Failed to load libmpv (last: {last_err})"))
    }
}
