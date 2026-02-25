use serde::Deserialize;
use serde_json::json;
use tauri::{AppHandle, State};

use super::player::{MpvPlayer, MpvState, MpvTrack};
use std::sync::Mutex;

pub type MpvPlayerState = Mutex<MpvPlayer>;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayOptions {
    pub url: String,
    pub start_position: Option<f64>,
    pub audio_track: Option<i64>,
    pub subtitle_track: Option<i64>,
}

/// Start the mpv process if not already running.
#[tauri::command]
pub fn mpv_start(
    app: AppHandle,
    state: State<'_, MpvPlayerState>,
) -> Result<(), String> {
    let mut player = state.lock().map_err(|e| e.to_string())?;
    player.start(app)
}

/// Load a media URL into mpv and begin playback.
#[tauri::command]
pub fn mpv_play(
    state: State<'_, MpvPlayerState>,
    options: PlayOptions,
) -> Result<(), String> {
    let player = state.lock().map_err(|e| e.to_string())?;

    // Set start position BEFORE loadfile (mpv's `start` affects the NEXT file load)
    if let Some(pos) = options.start_position {
        player.send_command(json!({
            "command": ["set_property", "start", format!("{:.1}", pos)]
        }))?;
    } else {
        // Reset start to beginning if no position provided
        player.send_command(json!({
            "command": ["set_property", "start", "none"]
        }))?;
    }

    // Load the file
    player.send_command(json!({
        "command": ["loadfile", options.url, "replace"]
    }))?;

    // Set audio track
    if let Some(aid) = options.audio_track {
        player.send_command(json!({
            "command": ["set_property", "aid", aid]
        }))?;
    }

    // Set subtitle track
    if let Some(sid) = options.subtitle_track {
        if sid == 0 {
            player.send_command(json!({
                "command": ["set_property", "sid", "no"]
            }))?;
        } else {
            player.send_command(json!({
                "command": ["set_property", "sid", sid]
            }))?;
        }
    }

    Ok(())
}

/// Pause or resume playback.
#[tauri::command]
pub fn mpv_toggle_pause(state: State<'_, MpvPlayerState>) -> Result<(), String> {
    let player = state.lock().map_err(|e| e.to_string())?;
    player.send_command(json!({
        "command": ["cycle", "pause"]
    }))?;
    Ok(())
}

/// Set the pause state explicitly.
#[tauri::command]
pub fn mpv_set_pause(
    state: State<'_, MpvPlayerState>,
    paused: bool,
) -> Result<(), String> {
    let player = state.lock().map_err(|e| e.to_string())?;
    player.send_command(json!({
        "command": ["set_property", "pause", paused]
    }))?;
    Ok(())
}

/// Seek to an absolute position in seconds.
#[tauri::command]
pub fn mpv_seek(
    state: State<'_, MpvPlayerState>,
    position: f64,
) -> Result<(), String> {
    let player = state.lock().map_err(|e| e.to_string())?;
    player.send_command(json!({
        "command": ["seek", position, "absolute"]
    }))?;
    Ok(())
}

/// Seek relative to current position.
#[tauri::command]
pub fn mpv_seek_relative(
    state: State<'_, MpvPlayerState>,
    offset: f64,
) -> Result<(), String> {
    let player = state.lock().map_err(|e| e.to_string())?;
    player.send_command(json!({
        "command": ["seek", offset, "relative"]
    }))?;
    Ok(())
}

/// Set the audio track by mpv track ID.
#[tauri::command]
pub fn mpv_set_audio_track(
    state: State<'_, MpvPlayerState>,
    track_id: i64,
) -> Result<(), String> {
    let player = state.lock().map_err(|e| e.to_string())?;
    player.send_command(json!({
        "command": ["set_property", "aid", track_id]
    }))?;
    Ok(())
}

/// Set the subtitle track by mpv track ID. 0 = disable.
#[tauri::command]
pub fn mpv_set_subtitle_track(
    state: State<'_, MpvPlayerState>,
    track_id: i64,
) -> Result<(), String> {
    let player = state.lock().map_err(|e| e.to_string())?;
    if track_id == 0 {
        player.send_command(json!({
            "command": ["set_property", "sid", "no"]
        }))?;
    } else {
        player.send_command(json!({
            "command": ["set_property", "sid", track_id]
        }))?;
    }
    Ok(())
}

/// Set volume (0-100).
#[tauri::command]
pub fn mpv_set_volume(
    state: State<'_, MpvPlayerState>,
    volume: f64,
) -> Result<(), String> {
    let player = state.lock().map_err(|e| e.to_string())?;
    player.send_command(json!({
        "command": ["set_property", "volume", volume]
    }))?;
    Ok(())
}

/// Toggle mute.
#[tauri::command]
pub fn mpv_toggle_mute(state: State<'_, MpvPlayerState>) -> Result<(), String> {
    let player = state.lock().map_err(|e| e.to_string())?;
    player.send_command(json!({
        "command": ["cycle", "mute"]
    }))?;
    Ok(())
}

/// Get the current mpv state.
#[tauri::command]
pub fn mpv_get_state(state: State<'_, MpvPlayerState>) -> Result<MpvState, String> {
    let player = state.lock().map_err(|e| e.to_string())?;
    Ok(player.get_state())
}

/// Get the track list from mpv.
#[tauri::command]
pub fn mpv_get_tracks(state: State<'_, MpvPlayerState>) -> Result<Vec<MpvTrack>, String> {
    let player = state.lock().map_err(|e| e.to_string())?;
    let _result = player.send_command(json!({
        "command": ["get_property", "track-list"]
    }))?;

    // Tracks are better obtained via the mpv:state event
    Ok(vec![])
}

/// Stop playback and kill mpv.
#[tauri::command]
pub fn mpv_stop(state: State<'_, MpvPlayerState>) -> Result<(), String> {
    let mut player = state.lock().map_err(|e| e.to_string())?;
    player.stop();
    Ok(())
}

/// Check if mpv is running.
#[tauri::command]
pub fn mpv_is_alive(state: State<'_, MpvPlayerState>) -> Result<bool, String> {
    let player = state.lock().map_err(|e| e.to_string())?;
    Ok(player.is_alive())
}
