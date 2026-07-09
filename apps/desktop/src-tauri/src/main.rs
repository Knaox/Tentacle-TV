// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod video_surface;

#[cfg(target_os = "windows")]
mod msix_update;

#[cfg(target_os = "windows")]
mod smtc;

#[cfg(target_os = "windows")]
mod audio_session;

#[cfg(target_os = "windows")]
mod mpv_window;

#[cfg(target_os = "windows")]
mod win_freeze_probe;

#[cfg(target_os = "macos")]
mod macos;

fn main() {
    // Diagnostic opt-in (TENTACLE_FREEZE_PROBE=1) : surveille depuis un thread dédié
    // si le thread UI se retrouve dans une boucle modale ou avec une capture souris
    // orpheline — les deux façons dont la fenêtre enfant de mpv peut geler l'app.
    #[cfg(target_os = "windows")]
    win_freeze_probe::spawn_if_enabled(unsafe {
        windows::Win32::System::Threading::GetCurrentThreadId()
    });

    // Pas de tauri-plugin-updater : macOS est distribué via le Mac App Store
    // (MAJ gérées par l'App Store) et Windows via le Microsoft Store (MSIX).
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init());

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
        builder = builder
            .manage(smtc::SmtcState::default())
            .invoke_handler(tauri::generate_handler![
                video_surface::toggle_fullscreen,
                video_surface::is_fullscreen,
                video_surface::exit_fullscreen,
                msix_update::check_msix_update,
                msix_update::download_and_install_msix_update,
                smtc::smtc_init,
                smtc::smtc_set_playback,
                smtc::smtc_set_metadata,
                smtc::smtc_clear,
                audio_session::set_audio_session_name,
                mpv_window::mpv_harden_child_window,
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
