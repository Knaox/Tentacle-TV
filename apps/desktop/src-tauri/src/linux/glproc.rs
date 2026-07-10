//! Résolution des pointeurs OpenGL à l'exécution (aucune dépendance de link
//! GL/EGL/epoxy).
//!
//! GtkGLArea peut utiliser GLX (X11) ou EGL (Wayland/`GDK_GL=egl`) : le bon
//! resolver de pointeurs diffère. On cherche donc : (1) le symbole exporté
//! directement par la pile GL déjà chargée par GTK (fonctions core via dlsym),
//! puis (2) `glXGetProcAddressARB` / `eglGetProcAddress` (fonctions d'extension).
//! Tout via `dlsym(RTLD_DEFAULT)` → robuste quelle que soit la config.

use std::ffi::{c_char, c_int, c_void};
use std::sync::OnceLock;

extern "C" {
    fn dlsym(handle: *mut c_void, symbol: *const c_char) -> *mut c_void;
}

// RTLD_DEFAULT (glibc/musl) : recherche dans la portée globale déjà chargée.
const RTLD_DEFAULT: *mut c_void = std::ptr::null_mut();

type ProcFn = unsafe extern "C" fn(*const c_char) -> *mut c_void;

/// Resolver passé à mpv (`MPV_RENDER_PARAM_OPENGL_INIT_PARAMS`). Signature imposée
/// par libmpv : `(ctx, name) -> ptr`.
pub unsafe extern "C" fn get_proc_address(_ctx: *mut c_void, name: *const c_char) -> *mut c_void {
    let direct = dlsym(RTLD_DEFAULT, name);
    if !direct.is_null() {
        return direct;
    }
    if let Some(loader) = gl_proc_loader() {
        return loader(name);
    }
    std::ptr::null_mut()
}

/// `glXGetProcAddressARB` / `eglGetProcAddress` selon ce qui est chargé (caché).
fn gl_proc_loader() -> Option<ProcFn> {
    static LOADER: OnceLock<usize> = OnceLock::new();
    let addr = *LOADER.get_or_init(|| unsafe {
        for sym in [
            b"eglGetProcAddress\0".as_ref(),
            b"glXGetProcAddressARB\0".as_ref(),
            b"glXGetProcAddress\0".as_ref(),
        ] {
            let p = dlsym(RTLD_DEFAULT, sym.as_ptr() as *const c_char);
            if !p.is_null() {
                return p as usize;
            }
        }
        0
    });
    if addr == 0 {
        None
    } else {
        Some(unsafe { std::mem::transmute::<usize, ProcFn>(addr) })
    }
}

// --- Les fonctions GL que nous appelons directement (hors mpv) ---
type GetIntegervFn = unsafe extern "C" fn(u32, *mut c_int);
type ClearFn = unsafe extern "C" fn(u32);
type ClearColorFn = unsafe extern "C" fn(f32, f32, f32, f32);
type ViewportFn = unsafe extern "C" fn(c_int, c_int, c_int, c_int);
type ScissorFn = unsafe extern "C" fn(c_int, c_int, c_int, c_int);
type BlendFuncSeparateFn = unsafe extern "C" fn(u32, u32, u32, u32);
type BindFramebufferFn = unsafe extern "C" fn(u32, u32);

pub struct GlFns {
    pub get_integerv: GetIntegervFn,
    pub clear: ClearFn,
    pub clear_color: ClearColorFn,
    pub viewport: ViewportFn,
    pub scissor: ScissorFn,
    pub blend_func_separate: BlendFuncSeparateFn,
    pub bind_framebuffer: BindFramebufferFn,
}

/// Résout (une fois) les entrées GL nécessaires via [`get_proc_address`].
/// À appeler avec un contexte GL courant (signal `render`). `None` si introuvable.
pub fn gl() -> Option<&'static GlFns> {
    static FNS: OnceLock<Option<GlFns>> = OnceLock::new();
    FNS.get_or_init(|| unsafe {
        let sym = |name: &[u8]| get_proc_address(RTLD_DEFAULT, name.as_ptr() as *const c_char);
        let gi = sym(b"glGetIntegerv\0");
        let cl = sym(b"glClear\0");
        let cc = sym(b"glClearColor\0");
        let vp = sym(b"glViewport\0");
        let sc = sym(b"glScissor\0");
        let bf = sym(b"glBlendFuncSeparate\0");
        let fb = sym(b"glBindFramebuffer\0");
        if [gi, cl, cc, vp, sc, bf, fb].iter().any(|p| p.is_null()) {
            eprintln!("[linux/glproc] résolution GL de base échouée");
            return None;
        }
        Some(GlFns {
            get_integerv: std::mem::transmute::<*mut c_void, GetIntegervFn>(gi),
            clear: std::mem::transmute::<*mut c_void, ClearFn>(cl),
            clear_color: std::mem::transmute::<*mut c_void, ClearColorFn>(cc),
            viewport: std::mem::transmute::<*mut c_void, ViewportFn>(vp),
            scissor: std::mem::transmute::<*mut c_void, ScissorFn>(sc),
            blend_func_separate: std::mem::transmute::<*mut c_void, BlendFuncSeparateFn>(bf),
            bind_framebuffer: std::mem::transmute::<*mut c_void, BindFramebufferFn>(fb),
        })
    })
    .as_ref()
}

pub const GL_DRAW_FRAMEBUFFER_BINDING: u32 = 0x8CA6;
pub const GL_COLOR_BUFFER_BIT: u32 = 0x0000_4000;
pub const GL_FRAMEBUFFER: u32 = 0x8D40;
pub const GL_ONE: u32 = 1;
pub const GL_ZERO: u32 = 0;
