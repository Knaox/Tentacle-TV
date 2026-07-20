//! Commandes Tauri du lecteur Linux — même surface que macOS (`mpv_init`,
//! `mpv_command`, `mpv_set_property`, `mpv_get_property`, `mpv_destroy`).
//!
//! Différence clé avec macOS : aucune surface GL n'est créée ici. Le GtkGLArea
//! est persistant (monté au setup, cf. `overlay.rs`) et le `mpv_render_context`
//! est créé paresseusement au 1er signal `render` (contexte OpenGL courant).
//! `mpv_init` se contente donc d'armer mpv et de demander ce 1er render.

use std::ffi::{c_int, c_void, CStr, CString};
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::thread;

use serde_json::Value;
use tauri::{command, AppHandle, State};

use super::mpv_ffi::*;
use super::RenderState;

#[command]
pub async fn mpv_init(
    state: State<'_, Arc<RenderState>>,
    app: AppHandle,
    options: Value,
) -> Result<String, String> {
    let lib = &state.mpv_lib;

    let mpv = unsafe { (lib.create)() };
    if mpv.is_null() {
        return Err("mpv_create a renvoyé null".to_string());
    }

    // Options par défaut du Render API (vo=libmpv obligatoire ; OSD coupé, on
    // dessine les contrôles en HTML). ao laissé en auto (pulse/pipewire/alsa).
    let defaults = [
        ("vo", "libmpv"),
        ("hwdec", "auto-safe"),
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

    // initialOptions du frontend (on force vo=libmpv → on saute la clé vo).
    if let Some(opts) = options.get("initialOptions").and_then(|v| v.as_object()) {
        for (key, val) in opts {
            if key == "vo" {
                continue;
            }
            let val_str = match val {
                Value::String(s) => s.clone(),
                Value::Bool(b) => if *b { "yes".to_string() } else { "no".to_string() },
                Value::Number(n) => n.to_string(),
                _ => continue,
            };
            let c_key = CString::new(key.as_str()).map_err(|e| format!("Clé invalide : {e}"))?;
            let c_val = CString::new(val_str.as_str()).map_err(|e| format!("Valeur invalide : {e}"))?;
            unsafe { (lib.set_option_string)(mpv, c_key.as_ptr(), c_val.as_ptr()); }
        }
    }

    let err = unsafe { (lib.initialize)(mpv) };
    if err < 0 {
        unsafe { (lib.destroy)(mpv); }
        return Err(format!("mpv_initialize a échoué : {err}"));
    }

    // Publier le handle + l'app handle AVANT d'armer le rendu et le thread events.
    *state.mpv_handle.lock().unwrap() = mpv;
    *state.app_handle.lock().unwrap() = Some(app);
    state.should_stop.store(false, Ordering::SeqCst);

    // Observer les propriétés demandées par le frontend.
    if let Some(props) = options.get("observedProperties").and_then(|v| v.as_array()) {
        observe_properties(&state, props)?;
    }

    // Thread d'évènements mpv (émet mpv://event, mpv://property-change).
    let state_events = Arc::clone(&state);
    let handle = thread::Builder::new()
        .name("mpv-events".into())
        .spawn(move || super::events::event_loop(state_events))
        .map_err(|e| format!("spawn thread events : {e}"))?;
    *state.event_thread.lock().unwrap() = Some(handle);

    // Demander la création du render context au prochain `render` + le déclencher.
    state.want_render_ctx.store(true, Ordering::SeqCst);
    state.needs_render.store(true, Ordering::SeqCst);

    Ok("mpv initialisé (Render API GtkGLArea)".to_string())
}

fn observe_properties(state: &RenderState, properties: &[Value]) -> Result<(), String> {
    let mpv = *state.mpv_handle.lock().unwrap();
    if mpv.is_null() {
        return Err("mpv non initialisé".to_string());
    }
    for (i, prop) in properties.iter().enumerate() {
        let arr = prop.as_array().ok_or("propriété : tableau attendu")?;
        let name = arr.first().and_then(|v| v.as_str()).ok_or("nom de propriété : chaîne attendue")?;
        let format_str = arr.get(1).and_then(|v| v.as_str()).ok_or("format de propriété : chaîne attendue")?;
        let format = match format_str {
            "flag" => MPV_FORMAT_FLAG,
            "int64" => MPV_FORMAT_INT64,
            "double" => MPV_FORMAT_DOUBLE,
            "string" => MPV_FORMAT_STRING,
            _ => MPV_FORMAT_NONE,
        };
        let c_name = CString::new(name).map_err(|e| format!("Nom de propriété invalide : {e}"))?;
        let err = unsafe {
            (state.mpv_lib.observe_property)(mpv, (i + 1) as u64, c_name.as_ptr(), format)
        };
        if err < 0 {
            eprintln!("[linux/mpv] observe_property a échoué pour {name} : {err}");
        }
    }
    Ok(())
}

/// Quote un argument pour la syntaxe TEXTE de commande mpv — miroir exact de
/// `macos/commands.rs::quote_command_arg` (les arguments simples restent
/// inchangés, seuls espaces/quotes/backslash/dièse déclenchent le quoting).
fn quote_command_arg(raw: &str) -> String {
    let needs_quoting = raw.is_empty()
        || raw
            .chars()
            .any(|c| c.is_whitespace() || c == '"' || c == '\\' || c == '#' || c == '\'');
    if !needs_quoting {
        return raw.to_string();
    }
    let mut quoted = String::with_capacity(raw.len() + 2);
    quoted.push('"');
    for c in raw.chars() {
        if c == '"' || c == '\\' {
            quoted.push('\\');
        }
        quoted.push(c);
    }
    quoted.push('"');
    quoted
}

#[command]
pub async fn mpv_command(
    state: State<'_, Arc<RenderState>>,
    name: String,
    args: Vec<Value>,
) -> Result<(), String> {
    let mpv = *state.mpv_handle.lock().unwrap();
    if mpv.is_null() {
        return Err("mpv non initialisé".to_string());
    }
    // Les chaînes passent par quote_command_arg : `mpv_command_string` scinde
    // sur les espaces — un chemin local avec espaces cassait `loadfile`/`sub-add`.
    let mut parts = vec![name];
    for arg in &args {
        match arg {
            Value::String(s) => parts.push(quote_command_arg(s)),
            Value::Number(n) => parts.push(n.to_string()),
            Value::Bool(b) => parts.push(if *b { "yes".to_string() } else { "no".to_string() }),
            _ => parts.push(arg.to_string()),
        }
    }
    let cmd_str = parts.join(" ");
    let c_cmd = CString::new(cmd_str.as_str()).map_err(|e| format!("Commande invalide : {e}"))?;
    let err = unsafe { (state.mpv_lib.command_string)(mpv, c_cmd.as_ptr()) };
    if err < 0 {
        return Err(format!("mpv_command_string a échoué pour '{cmd_str}' : {err}"));
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
        return Err("mpv non initialisé".to_string());
    }
    let val_str = match &value {
        Value::String(s) => s.clone(),
        Value::Number(n) => n.to_string(),
        Value::Bool(b) => if *b { "yes".to_string() } else { "no".to_string() },
        _ => return Err(format!("Type de valeur non supporté : {value}")),
    };
    let c_name = CString::new(name.as_str()).map_err(|e| format!("Nom invalide : {e}"))?;
    let c_val = CString::new(val_str.as_str()).map_err(|e| format!("Valeur invalide : {e}"))?;
    let err = unsafe { (state.mpv_lib.set_property_string)(mpv, c_name.as_ptr(), c_val.as_ptr()) };
    if err < 0 {
        return Err(format!("mpv_set_property_string a échoué pour '{name}' : {err}"));
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
        return Err("mpv non initialisé".to_string());
    }
    let c_name = CString::new(name.as_str()).map_err(|e| format!("Nom invalide : {e}"))?;
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
        _ => Err(format!("Format de propriété inconnu : {format}")),
    }
}

#[command]
pub async fn mpv_destroy(state: State<'_, Arc<RenderState>>) -> Result<(), String> {
    let state = Arc::clone(state.inner());

    // Empêcher toute (re)création de render context pendant la destruction.
    state.want_render_ctx.store(false, Ordering::SeqCst);

    // Arrêter le thread d'évènements : signal + `quit` (réveille wait_event).
    state.should_stop.store(true, Ordering::SeqCst);
    let mpv = *state.mpv_handle.lock().unwrap();
    if !mpv.is_null() {
        let quit = CString::new("quit").unwrap();
        unsafe { (state.mpv_lib.command_string)(mpv, quit.as_ptr()); }
    }
    if let Some(h) = state.event_thread.lock().unwrap().take() {
        let _ = h.join();
    }

    // Libérer le render context sur le thread GTK (contexte GL courant). On le
    // détache d'abord de l'état (les prochains `render` verront null → noir).
    let render_ctx = std::mem::replace(
        &mut *state.render_ctx.lock().unwrap(),
        std::ptr::null_mut(),
    );
    if !render_ctx.is_null() {
        let s = Arc::clone(&state);
        let rc = render_ctx as usize;
        let _ = super::util::run_on_main(move || {
            super::render::free_render_context(&s, rc as *mut c_void);
        });
    }

    // Détruire le handle mpv.
    let mpv = std::mem::replace(
        &mut *state.mpv_handle.lock().unwrap(),
        std::ptr::null_mut(),
    );
    if !mpv.is_null() {
        unsafe { (state.mpv_lib.destroy)(mpv); }
    }

    *state.app_handle.lock().unwrap() = None;
    // Repeindre le GLArea en noir (efface la dernière frame).
    state.needs_render.store(true, Ordering::SeqCst);
    Ok(())
}
