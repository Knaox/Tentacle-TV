// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod video_surface;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_libmpv::init())
        .invoke_handler(tauri::generate_handler![
            video_surface::toggle_fullscreen,
            video_surface::is_fullscreen,
            video_surface::exit_fullscreen,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tentacle desktop");
}
