use std::ffi::{c_char, c_int, CStr};
use std::sync::atomic::Ordering;
use std::sync::Arc;

use serde_json::{json, Value};
use tauri::Emitter;

use super::mpv_ffi::*;
use super::render::RenderState;

pub fn event_loop(state: Arc<RenderState>) {
    let lib = &state.mpv_lib;

    loop {
        if state.should_stop.load(Ordering::SeqCst) {
            break;
        }

        let mpv = *state.mpv_handle.lock().unwrap();
        if mpv.is_null() {
            break;
        }

        let event = unsafe { &*(lib.wait_event)(mpv, 0.1) };

        match event.event_id {
            MPV_EVENT_NONE => continue,
            MPV_EVENT_SHUTDOWN => break,
            MPV_EVENT_PROPERTY_CHANGE => handle_property_change(event, &state),
            MPV_EVENT_FILE_LOADED => {
                emit_event(&state, "mpv://event", &json!({ "event": "file-loaded" }));
            }
            MPV_EVENT_PLAYBACK_RESTART => {
                emit_event(&state, "mpv://event", &json!({ "event": "playback-restart" }));
            }
            MPV_EVENT_END_FILE => handle_end_file(event, &state),
            MPV_EVENT_IDLE => {
                emit_event(&state, "mpv://event", &json!({ "event": "idle" }));
            }
            _ => {}
        }
    }
}

fn handle_property_change(event: &MpvEventStruct, state: &RenderState) {
    if event.data.is_null() {
        return;
    }
    let prop = unsafe { &*(event.data as *const MpvEventProperty) };
    let name = unsafe { CStr::from_ptr(prop.name) }
        .to_string_lossy()
        .to_string();

    let data: Value = if prop.data.is_null() {
        Value::Null
    } else {
        match prop.format {
            MPV_FORMAT_FLAG => {
                let val = unsafe { *(prop.data as *const c_int) };
                json!(val != 0)
            }
            MPV_FORMAT_INT64 => {
                let val = unsafe { *(prop.data as *const i64) };
                json!(val)
            }
            MPV_FORMAT_DOUBLE => {
                let val = unsafe { *(prop.data as *const f64) };
                json!(val)
            }
            MPV_FORMAT_STRING => {
                let ptr = unsafe { *(prop.data as *const *const c_char) };
                if ptr.is_null() {
                    Value::Null
                } else {
                    let s = unsafe { CStr::from_ptr(ptr) }
                        .to_string_lossy()
                        .to_string();
                    json!(s)
                }
            }
            _ => Value::Null,
        }
    };

    let payload = json!({
        "event": "property-change",
        "name": name,
        "data": data,
        "id": event.reply_userdata,
    });
    emit_event(state, "mpv://property-change", &payload);
}

fn handle_end_file(event: &MpvEventStruct, state: &RenderState) {
    let payload = if !event.data.is_null() {
        let ef = unsafe { &*(event.data as *const MpvEventEndFile) };
        let reason = match ef.reason {
            MPV_END_FILE_REASON_EOF => "eof",
            MPV_END_FILE_REASON_STOP => "stop",
            MPV_END_FILE_REASON_QUIT => "quit",
            MPV_END_FILE_REASON_ERROR => "error",
            MPV_END_FILE_REASON_REDIRECT => "redirect",
            _ => "unknown",
        };
        json!({
            "event": "end-file",
            "reason": reason,
            "error": ef.error,
            "playlist_entry_id": ef.playlist_entry_id,
            "playlist_insert_id": ef.playlist_insert_id,
            "playlist_insert_num_entries": ef.playlist_insert_num_entries,
        })
    } else {
        json!({ "event": "end-file", "reason": "unknown" })
    };
    emit_event(state, "mpv://event", &payload);
}

fn emit_event(state: &RenderState, event_name: &str, payload: &Value) {
    if let Some(ref app) = *state.app_handle.lock().unwrap() {
        let _ = app.emit(event_name, payload.clone());
    }
}
