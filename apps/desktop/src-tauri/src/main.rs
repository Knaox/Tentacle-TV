// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod video_surface;

#[cfg(target_os = "windows")]
mod msix_update;

#[cfg(target_os = "macos")]
mod macos;

fn main() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init());

    // Windows/Linux: use tauri-plugin-libmpv
    #[cfg(not(target_os = "macos"))]
    {
        builder = builder.plugin(tauri_plugin_libmpv::init());
    }

    // macOS: custom mpv render API with managed state
    #[cfg(target_os = "macos")]
    {
        let mpv_lib = macos::MpvLib::load().expect("Failed to load libmpv");
        let render_state = std::sync::Arc::new(macos::RenderState::new(mpv_lib));
        let sleep_assertion = macos::SleepAssertion::new();

        builder = builder
            .manage(render_state)
            .manage(sleep_assertion)
            .invoke_handler(tauri::generate_handler![
                video_surface::toggle_fullscreen,
                video_surface::is_fullscreen,
                video_surface::exit_fullscreen,
                macos::commands::mpv_init,
                macos::commands::mpv_command,
                macos::commands::mpv_set_property,
                macos::commands::mpv_get_property,
                macos::commands::mpv_destroy,
                macos::sleep_assertion::prevent_display_sleep_start,
                macos::sleep_assertion::prevent_display_sleep_stop,
            ]);
    }

    #[cfg(target_os = "windows")]
    {
        builder = builder.invoke_handler(tauri::generate_handler![
            video_surface::toggle_fullscreen,
            video_surface::is_fullscreen,
            video_surface::exit_fullscreen,
            msix_update::check_msix_update,
            msix_update::download_and_install_msix_update,
        ]);
    }

    #[cfg(target_os = "linux")]
    {
        builder = builder.invoke_handler(tauri::generate_handler![
            video_surface::toggle_fullscreen,
            video_surface::is_fullscreen,
            video_surface::exit_fullscreen,
        ]);
    }

    builder
        .run(tauri::generate_context!())
        .expect("error while running Tentacle desktop");
}
