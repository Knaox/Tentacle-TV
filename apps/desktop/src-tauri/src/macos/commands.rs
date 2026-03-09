use std::ffi::{c_int, c_void, CStr, CString};
use std::sync::Arc;

use serde_json::Value;
use tauri::{command, AppHandle, State};

use super::mpv_ffi::*;
use super::render::RenderState;

#[command]
pub async fn mpv_init(
    window: tauri::WebviewWindow,
    state: State<'_, Arc<RenderState>>,
    app: AppHandle,
    options: Value,
) -> Result<String, String> {
    let lib = &state.mpv_lib;

    // Create mpv handle
    let mpv = unsafe { (lib.create)() };
    if mpv.is_null() {
        return Err("mpv_create returned null".to_string());
    }

    // Set default options for macOS render API
    let defaults = [
        ("vo", "libmpv"),
        ("hwdec", "auto-safe"),
        ("ao", "coreaudio"),
        // Disable OSD completely (we use HTML controls)
        ("osd-level", "0"),
        ("osd-bar", "no"),
        ("osd-on-seek", "no"),
        ("osd-duration", "0"),
        ("osd-scale", "0"),
        ("osd-playing-msg", ""),
    ];
    for (k, v) in &defaults {
        let key = CString::new(*k).unwrap();
        let val = CString::new(*v).unwrap();
        unsafe { (lib.set_option_string)(mpv, key.as_ptr(), val.as_ptr()); }
    }

    // Apply frontend initialOptions
    if let Some(opts) = options.get("initialOptions").and_then(|v| v.as_object()) {
        for (key, val) in opts {
            // Skip vo — we force libmpv
            if key == "vo" { continue; }
            let val_str = match val {
                Value::String(s) => s.clone(),
                Value::Bool(b) => if *b { "yes".to_string() } else { "no".to_string() },
                Value::Number(n) => n.to_string(),
                _ => continue,
            };
            let c_key = CString::new(key.as_str()).map_err(|e| format!("Invalid option key: {e}"))?;
            let c_val = CString::new(val_str.as_str()).map_err(|e| format!("Invalid option value: {e}"))?;
            unsafe { (lib.set_option_string)(mpv, c_key.as_ptr(), c_val.as_ptr()); }
        }
    }

    // Initialize mpv
    let err = unsafe { (lib.initialize)(mpv) };
    if err < 0 {
        unsafe { (lib.destroy)(mpv); }
        return Err(format!("mpv_initialize failed: {err}"));
    }

    // Get NSWindow pointer (convert to usize for Send)
    let ns_window_addr = window.ns_window()
        .map_err(|e| format!("Failed to get NSWindow: {e}"))? as usize;

    // Create GL surface — MUST run on the main thread (Cocoa UI calls)
    let surface = super::util::run_on_main_thread(move || unsafe {
        super::gl_surface::create_gl_surface(ns_window_addr as *mut c_void)
    }).map_err(|e| format!("Main thread dispatch failed: {e}"))??;

    // Start render + event threads
    super::render::start_render(
        &state,
        mpv,
        surface.cgl_context,
        surface.pixel_width,
        surface.pixel_height,
        surface.scale_factor,
        surface.gl_view,
        app,
    )?;

    // Observe properties from frontend config
    if let Some(props) = options.get("observedProperties").and_then(|v| v.as_array()) {
        super::render::observe_properties(&state, props)?;
    }

    Ok("mpv initialized with render API".to_string())
}

#[command]
pub async fn mpv_command(
    state: State<'_, Arc<RenderState>>,
    name: String,
    args: Vec<Value>,
) -> Result<(), String> {
    let mpv = *state.mpv_handle.lock().unwrap();
    if mpv.is_null() {
        return Err("mpv not initialized".to_string());
    }

    // Build command string: "name arg1 arg2 ..."
    let mut parts = vec![name];
    for arg in &args {
        match arg {
            Value::String(s) => parts.push(s.clone()),
            Value::Number(n) => parts.push(n.to_string()),
            Value::Bool(b) => parts.push(if *b { "yes".to_string() } else { "no".to_string() }),
            _ => parts.push(arg.to_string()),
        }
    }
    let cmd_str = parts.join(" ");
    let c_cmd = CString::new(cmd_str.as_str())
        .map_err(|e| format!("Invalid command string: {e}"))?;

    let err = unsafe { (state.mpv_lib.command_string)(mpv, c_cmd.as_ptr()) };
    if err < 0 {
        return Err(format!("mpv_command_string failed for '{cmd_str}': {err}"));
    }
    Ok(())
}

#[command]
pub async fn mpv_set_property(
    state: State<'_, Arc<RenderState>>,
    name: String,
    value: Value,
) -> Result<(), String> {
    let mpv = *state.mpv_handle.lock().unwrap();
    if mpv.is_null() {
        return Err("mpv not initialized".to_string());
    }

    let val_str = match &value {
        Value::String(s) => s.clone(),
        Value::Number(n) => n.to_string(),
        Value::Bool(b) => if *b { "yes".to_string() } else { "no".to_string() },
        _ => return Err(format!("Unsupported property value type: {value}")),
    };

    let c_name = CString::new(name.as_str()).map_err(|e| format!("Invalid name: {e}"))?;
    let c_val = CString::new(val_str.as_str()).map_err(|e| format!("Invalid value: {e}"))?;

    let err = unsafe { (state.mpv_lib.set_property_string)(mpv, c_name.as_ptr(), c_val.as_ptr()) };
    if err < 0 {
        return Err(format!("mpv_set_property_string failed for '{name}': {err}"));
    }
    Ok(())
}

#[command]
pub async fn mpv_get_property(
    state: State<'_, Arc<RenderState>>,
    name: String,
    format: String,
) -> Result<Value, String> {
    let mpv = *state.mpv_handle.lock().unwrap();
    if mpv.is_null() {
        return Err("mpv not initialized".to_string());
    }

    let c_name = CString::new(name.as_str()).map_err(|e| format!("Invalid name: {e}"))?;
    let lib = &state.mpv_lib;

    match format.as_str() {
        "string" => {
            let ptr = unsafe { (lib.get_property_string)(mpv, c_name.as_ptr()) };
            if ptr.is_null() {
                return Ok(Value::Null);
            }
            let s = unsafe { CStr::from_ptr(ptr) }.to_string_lossy().to_string();
            unsafe { (lib.free)(ptr as *mut c_void); }
            Ok(Value::String(s))
        }
        "flag" => {
            let mut val: c_int = 0;
            let err = unsafe {
                (lib.get_property)(mpv, c_name.as_ptr(), MPV_FORMAT_FLAG, &mut val as *mut _ as *mut c_void)
            };
            if err < 0 { return Ok(Value::Null); }
            Ok(Value::Bool(val != 0))
        }
        "int64" => {
            let mut val: i64 = 0;
            let err = unsafe {
                (lib.get_property)(mpv, c_name.as_ptr(), MPV_FORMAT_INT64, &mut val as *mut _ as *mut c_void)
            };
            if err < 0 { return Ok(Value::Null); }
            Ok(serde_json::json!(val))
        }
        "double" => {
            let mut val: f64 = 0.0;
            let err = unsafe {
                (lib.get_property)(mpv, c_name.as_ptr(), MPV_FORMAT_DOUBLE, &mut val as *mut _ as *mut c_void)
            };
            if err < 0 { return Ok(Value::Null); }
            Ok(serde_json::json!(val))
        }
        _ => Err(format!("Unknown property format: {format}")),
    }
}

#[command]
pub async fn mpv_destroy(
    state: State<'_, Arc<RenderState>>,
) -> Result<(), String> {
    super::render::destroy(&state);
    Ok(())
}
