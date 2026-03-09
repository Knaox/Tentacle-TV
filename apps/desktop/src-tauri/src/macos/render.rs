use std::ffi::{c_char, c_int, c_void, CString};
use std::sync::atomic::{AtomicBool, AtomicI32, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;

use serde_json::Value;
use tauri::AppHandle;

use super::mpv_ffi::*;

pub struct RenderState {
    pub needs_render: AtomicBool,
    pub should_stop: AtomicBool,
    pub mpv_handle: Mutex<*mut c_void>,
    pub render_ctx: Mutex<*mut c_void>,
    pub width: AtomicI32,
    pub height: AtomicI32,
    pub scale_factor: AtomicI32, // stored as scale * 100
    pub gl_view: Mutex<*mut c_void>,
    pub app_handle: Mutex<Option<AppHandle>>,
    pub mpv_lib: MpvLib,
    pub cgl_context: Mutex<*mut c_void>,
    pub render_thread: Mutex<Option<thread::JoinHandle<()>>>,
    pub event_thread: Mutex<Option<thread::JoinHandle<()>>>,
}

// SAFETY: raw pointers are protected by Mutex, accessed only via locked guards
unsafe impl Send for RenderState {}
unsafe impl Sync for RenderState {}

impl RenderState {
    pub fn new(mpv_lib: MpvLib) -> Self {
        Self {
            needs_render: AtomicBool::new(false),
            should_stop: AtomicBool::new(false),
            mpv_handle: Mutex::new(std::ptr::null_mut()),
            render_ctx: Mutex::new(std::ptr::null_mut()),
            width: AtomicI32::new(0),
            height: AtomicI32::new(0),
            scale_factor: AtomicI32::new(100),
            gl_view: Mutex::new(std::ptr::null_mut()),
            app_handle: Mutex::new(None),
            mpv_lib,
            cgl_context: Mutex::new(std::ptr::null_mut()),
            render_thread: Mutex::new(None),
            event_thread: Mutex::new(None),
        }
    }
}

/// Wakeup callback — called by mpv render context when a new frame is ready.
unsafe extern "C" fn render_wakeup(ctx: *mut c_void) {
    let state = &*(ctx as *const RenderState);
    state.needs_render.store(true, Ordering::SeqCst);
}

/// OpenGL getProcAddress callback.
unsafe extern "C" fn get_proc_address(_ctx: *mut c_void, name: *const c_char) -> *mut c_void {
    extern "C" {
        fn dlopen(filename: *const c_char, flags: c_int) -> *mut c_void;
        fn dlsym(handle: *mut c_void, symbol: *const c_char) -> *mut c_void;
        fn dlclose(handle: *mut c_void) -> c_int;
    }
    const RTLD_LAZY: c_int = 1;
    let framework = b"/System/Library/Frameworks/OpenGL.framework/OpenGL\0";
    let handle = dlopen(framework.as_ptr() as *const c_char, RTLD_LAZY);
    if handle.is_null() {
        return std::ptr::null_mut();
    }
    let ptr = dlsym(handle, name);
    dlclose(handle);
    ptr
}

/// Initialize mpv render context and start render + event threads.
pub fn start_render(
    state: &Arc<RenderState>,
    mpv: *mut c_void,
    cgl_context: *mut c_void,
    width: i32,
    height: i32,
    scale_factor: f64,
    gl_view: *mut c_void,
    app_handle: AppHandle,
) -> Result<(), String> {
    let lib = &state.mpv_lib;

    // Make CGL context current before creating render context
    extern "C" {
        fn CGLSetCurrentContext(ctx: *mut c_void) -> c_int;
    }
    unsafe { CGLSetCurrentContext(cgl_context); }

    let mut render_ctx: *mut c_void = std::ptr::null_mut();
    let api_type = CString::new("opengl").unwrap();

    let mut gl_init = MpvOpenGLInitParams {
        get_proc_address: Some(get_proc_address),
        get_proc_address_ctx: std::ptr::null_mut(),
    };

    let mut params = [
        MpvRenderParam {
            type_: MPV_RENDER_PARAM_API_TYPE,
            data: api_type.as_ptr() as *mut c_void,
        },
        MpvRenderParam {
            type_: MPV_RENDER_PARAM_OPENGL_INIT_PARAMS,
            data: &mut gl_init as *mut _ as *mut c_void,
        },
        MpvRenderParam {
            type_: MPV_RENDER_PARAM_INVALID,
            data: std::ptr::null_mut(),
        },
    ];

    let err = unsafe {
        (lib.render_context_create)(&mut render_ctx, mpv, params.as_mut_ptr())
    };
    if err < 0 {
        return Err(format!("mpv_render_context_create failed: {err}"));
    }

    // Store state
    *state.mpv_handle.lock().unwrap() = mpv;
    *state.render_ctx.lock().unwrap() = render_ctx;
    *state.gl_view.lock().unwrap() = gl_view;
    *state.cgl_context.lock().unwrap() = cgl_context;
    *state.app_handle.lock().unwrap() = Some(app_handle);
    state.width.store(width, Ordering::SeqCst);
    state.height.store(height, Ordering::SeqCst);
    state.scale_factor.store((scale_factor * 100.0) as i32, Ordering::SeqCst);
    state.should_stop.store(false, Ordering::SeqCst);

    // Set wakeup callback
    unsafe {
        (lib.render_context_set_update_callback)(
            render_ctx,
            Some(render_wakeup),
            Arc::as_ptr(state) as *mut c_void,
        );
    }

    // Spawn render thread
    let state_render = Arc::clone(state);
    let cgl = cgl_context as usize;
    let handle_render = thread::Builder::new()
        .name("mpv-render".into())
        .spawn(move || render_loop(state_render, cgl as *mut c_void))
        .map_err(|e| format!("Failed to spawn render thread: {e}"))?;
    *state.render_thread.lock().unwrap() = Some(handle_render);

    // Spawn event thread
    let state_events = Arc::clone(state);
    let handle_events = thread::Builder::new()
        .name("mpv-events".into())
        .spawn(move || super::events::event_loop(state_events))
        .map_err(|e| format!("Failed to spawn event thread: {e}"))?;
    *state.event_thread.lock().unwrap() = Some(handle_events);

    Ok(())
}

fn render_loop(state: Arc<RenderState>, cgl_context: *mut c_void) {
    extern "C" {
        fn CGLSetCurrentContext(ctx: *mut c_void) -> c_int;
        fn CGLFlushDrawable(ctx: *mut c_void) -> c_int;
    }

    let lib = &state.mpv_lib;

    loop {
        if state.should_stop.load(Ordering::SeqCst) {
            break;
        }

        if !state.needs_render.swap(false, Ordering::SeqCst) {
            thread::sleep(std::time::Duration::from_millis(4));
            continue;
        }

        // Update size from gl_view (handles resize)
        let scale = state.scale_factor.load(Ordering::SeqCst) as f64 / 100.0;
        let gl_view = *state.gl_view.lock().unwrap();
        if !gl_view.is_null() {
            let (w, h) = unsafe { super::gl_surface::get_surface_size(gl_view, scale) };
            if w > 0 && h > 0 {
                state.width.store(w, Ordering::SeqCst);
                state.height.store(h, Ordering::SeqCst);
            }
        }

        let render_ctx = *state.render_ctx.lock().unwrap();
        if render_ctx.is_null() {
            break;
        }

        let w = state.width.load(Ordering::SeqCst);
        let h = state.height.load(Ordering::SeqCst);

        unsafe {
            CGLSetCurrentContext(cgl_context);
        }

        let mut fbo = MpvOpenGLFbo {
            fbo: 0,
            w,
            h,
            internal_format: 0,
        };
        let mut flip_y: c_int = 1;

        let mut render_params = [
            MpvRenderParam {
                type_: MPV_RENDER_PARAM_OPENGL_FBO,
                data: &mut fbo as *mut _ as *mut c_void,
            },
            MpvRenderParam {
                type_: MPV_RENDER_PARAM_FLIP_Y,
                data: &mut flip_y as *mut _ as *mut c_void,
            },
            MpvRenderParam {
                type_: MPV_RENDER_PARAM_INVALID,
                data: std::ptr::null_mut(),
            },
        ];

        unsafe {
            (lib.render_context_render)(render_ctx, render_params.as_mut_ptr());
            CGLFlushDrawable(cgl_context);
            (lib.render_context_report_swap)(render_ctx);
        }
    }
}

/// Observe mpv properties based on the frontend's OBSERVED_PROPERTIES list.
pub fn observe_properties(state: &RenderState, properties: &[Value]) -> Result<(), String> {
    let mpv = *state.mpv_handle.lock().unwrap();
    if mpv.is_null() {
        return Err("mpv not initialized".to_string());
    }

    for (i, prop) in properties.iter().enumerate() {
        let arr = prop.as_array().ok_or("property must be an array")?;
        let name = arr.first()
            .and_then(|v| v.as_str())
            .ok_or("property name must be a string")?;
        let format_str = arr.get(1)
            .and_then(|v| v.as_str())
            .ok_or("property format must be a string")?;

        let format = match format_str {
            "flag" => MPV_FORMAT_FLAG,
            "int64" => MPV_FORMAT_INT64,
            "double" => MPV_FORMAT_DOUBLE,
            "string" => MPV_FORMAT_STRING,
            _ => MPV_FORMAT_NONE,
        };

        let c_name = CString::new(name).map_err(|e| format!("Invalid property name: {e}"))?;
        let err = unsafe {
            (state.mpv_lib.observe_property)(mpv, (i + 1) as u64, c_name.as_ptr(), format)
        };
        if err < 0 {
            eprintln!("[mpv] observe_property failed for {name}: {err}");
        }
    }
    Ok(())
}

/// Clean up mpv: stop threads, free render context and mpv handle, remove GL view.
pub fn destroy(state: &Arc<RenderState>) {
    let lib = &state.mpv_lib;

    // 1. Clear wakeup callback (prevents calls during cleanup)
    let render_ctx = *state.render_ctx.lock().unwrap();
    if !render_ctx.is_null() {
        unsafe {
            (lib.render_context_set_update_callback)(render_ctx, None, std::ptr::null_mut());
        }
    }

    // 2. Signal threads to stop
    state.should_stop.store(true, Ordering::SeqCst);

    // 3. Send quit command to mpv (triggers MPV_EVENT_SHUTDOWN in event_loop)
    let mpv = *state.mpv_handle.lock().unwrap();
    if !mpv.is_null() {
        let quit = CString::new("quit").unwrap();
        unsafe { (lib.command_string)(mpv, quit.as_ptr()); }
    }

    // 4. Join threads (wait for proper termination)
    if let Some(h) = state.render_thread.lock().unwrap().take() {
        let _ = h.join();
    }
    if let Some(h) = state.event_thread.lock().unwrap().take() {
        let _ = h.join();
    }

    // 5. Make CGL context current before freeing render context
    let cgl = *state.cgl_context.lock().unwrap();
    if !cgl.is_null() {
        extern "C" { fn CGLSetCurrentContext(ctx: *mut c_void) -> c_int; }
        unsafe { CGLSetCurrentContext(cgl); }
    }

    // 6. Free render context (GL context MUST be current)
    let render_ctx = std::mem::replace(&mut *state.render_ctx.lock().unwrap(), std::ptr::null_mut());
    if !render_ctx.is_null() {
        unsafe { (lib.render_context_free)(render_ctx); }
    }

    // 7. Destroy mpv handle
    let mpv = std::mem::replace(&mut *state.mpv_handle.lock().unwrap(), std::ptr::null_mut());
    if !mpv.is_null() {
        unsafe { (lib.destroy)(mpv); }
    }

    // 8. Remove NSOpenGLView from superview (must be on main thread)
    let gl_view = std::mem::replace(&mut *state.gl_view.lock().unwrap(), std::ptr::null_mut());
    if !gl_view.is_null() {
        let view_addr = gl_view as usize;
        super::util::dispatch_main_sync(move || unsafe {
            use objc2::msg_send;
            use objc2::runtime::AnyObject;
            let view = view_addr as *mut AnyObject;
            let _: () = msg_send![view, removeFromSuperview];
        });
    }

    // 9. Reset state
    *state.cgl_context.lock().unwrap() = std::ptr::null_mut();
    *state.app_handle.lock().unwrap() = None;
}
