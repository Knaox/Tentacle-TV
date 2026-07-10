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

#[cfg(target_os = "windows")]
mod win_stack;

/// Démonstration A/B du gel COM (`debug_com_break` / `debug_com_fixed`).
/// Jamais compilée en release : absente des builds Microsoft Store.
#[cfg(all(target_os = "windows", debug_assertions))]
mod debug_com;

#[cfg(target_os = "macos")]
mod macos;

/// Auto-updater Linux universel (aucun store) : détection format + download
/// vérifié + install pkexec/self-swap. Absent des builds macOS/Windows.
#[cfg(target_os = "linux")]
mod linux_update;

fn main() {
    // Linux : mpv s'embarque dans la fenêtre via `--wid`, qui n'existe QU'EN X11
    // (tauri-plugin-libmpv refuse Wayland — cf. utils::get_wid). On force donc
    // XWayland pour que la fenêtre Tauri soit une fenêtre X11 → mpv s'y embarque au
    // lieu d'ouvrir une 2ᵉ fenêtre. + contournement du rendu webkit (fenêtre
    // blanche) sur certains GPU/Wayland. Positionné AVANT toute init GTK/WebKit.
    #[cfg(target_os = "linux")]
    {
        if std::env::var_os("GDK_BACKEND").is_none() {
            std::env::set_var("GDK_BACKEND", "x11");
        }
        if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }
    }

    // En release, stderr est supprimé (windows_subsystem = "windows") : sans ça, une
    // panique Rust disparaîtrait sans laisser de trace.
    #[cfg(target_os = "windows")]
    win_freeze_probe::install_panic_logger();

    // Pas de tauri-plugin-updater : macOS est distribué via le Mac App Store
    // (MAJ gérées par l'App Store) et Windows via le Microsoft Store (MSIX).
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init());

    // Diagnostic opt-in (TENTACLE_FREEZE_PROBE=1) : depuis un thread dédié, mesure
    // séparément la réactivité du thread UI et du thread fenêtre de mpv pendant un gel.
    #[cfg(target_os = "windows")]
    {
        builder = builder.setup(|app| {
            use tauri::Manager;
            // `setup` s'exécute sur le thread de la boucle d'évènements.
            let tid = unsafe { windows::Win32::System::Threading::GetCurrentThreadId() };
            #[cfg(debug_assertions)]
            debug_com::remember_main_thread(tid);
            if let Some(hwnd) = app.get_webview_window("main").and_then(|w| w.hwnd().ok()) {
                win_freeze_probe::spawn_if_enabled(hwnd.0 as isize, tid);
            }
            Ok(())
        });
    }

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
        builder = builder.manage(smtc::SmtcState::default());

        // `invoke_handler` ne peut être posé qu'une fois : la liste est dupliquée pour
        // n'exposer les commandes de démonstration qu'en debug.
        #[cfg(not(debug_assertions))]
        {
            builder = builder.invoke_handler(tauri::generate_handler![
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

        #[cfg(debug_assertions)]
        {
            builder = builder.invoke_handler(tauri::generate_handler![
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
                debug_com::debug_com_check,
                debug_com::debug_com_fixed,
                debug_com::debug_com_break,
                debug_com::debug_audio_on_main,
                debug_com::debug_mark,
            ]);
        }
    }

    #[cfg(target_os = "linux")]
    {
        builder = builder.invoke_handler(tauri::generate_handler![
            video_surface::toggle_fullscreen,
            video_surface::is_fullscreen,
            video_surface::exit_fullscreen,
            linux_update::detect::detect_linux_install_format,
            linux_update::install::download_update,
            linux_update::install::install_linux_update,
        ]);
    }

    builder
        .run(tauri::generate_context!())
        .expect("error while running Tentacle desktop");
}
