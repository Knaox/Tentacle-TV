// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod mpv;

use mpv::commands::MpvPlayerState;
use mpv::player::MpvPlayer;
use std::sync::Mutex;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(Mutex::new(MpvPlayer::new()) as MpvPlayerState)
        .invoke_handler(tauri::generate_handler![
            mpv::commands::mpv_start,
            mpv::commands::mpv_play,
            mpv::commands::mpv_toggle_pause,
            mpv::commands::mpv_set_pause,
            mpv::commands::mpv_seek,
            mpv::commands::mpv_seek_relative,
            mpv::commands::mpv_set_audio_track,
            mpv::commands::mpv_set_subtitle_track,
            mpv::commands::mpv_set_volume,
            mpv::commands::mpv_toggle_mute,
            mpv::commands::mpv_get_state,
            mpv::commands::mpv_get_tracks,
            mpv::commands::mpv_stop,
            mpv::commands::mpv_is_alive,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tentacle desktop");
}
