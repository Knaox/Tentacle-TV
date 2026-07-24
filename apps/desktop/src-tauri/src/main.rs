// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod video_surface;

/// Mode Hors ligne & Téléchargements : base SQLite locale (cache de session,
/// puis index des téléchargements). Commun aux 3 OS.
mod downloads;

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

/// Lecteur vidéo Linux : mpv Render API OpenGL dans un GtkGLArea, webview
/// WebKitGTK transparente au-dessus dans un GtkOverlay (overlay HTML des
/// contrôles visible — remplace l'embarquement `--wid`). Absent macOS/Windows.
#[cfg(target_os = "linux")]
mod linux;

/// Auto-updater Linux universel (aucun store) : détection format + download
/// vérifié + install pkexec/self-swap. Absent des builds macOS/Windows.
#[cfg(target_os = "linux")]
mod linux_update;

fn main() {
    // Linux : ⚠️ ne JAMAIS poser WEBKIT_DISABLE_DMABUF_RENDERER ici. Sur
    // WebKitGTK ≥ 2.48 le renderer DMABUF est le SEUL chemin de compositing
    // accéléré : le désactiver bascule WebKit en peinture cairo non composée,
    // dont le repaint incrémental n'efface pas les pixels abandonnés sur fond
    // transparent → chaque menu/vignette au-dessus de la vidéo mpv laissait un
    // FANTÔME à l'écran jusqu'au redimensionnement. (Relique de l'ère `--wid`
    // X11, comme le forçage GDK_BACKEND=x11, supprimé aussi — le Render API
    // fonctionne en Wayland natif.)
    //
    // NVIDIA/Wayland : ne pas désactiver l'explicit sync (`__NV_DISABLE_
    // EXPLICIT_SYNC=1`) — sans lui le driver retombe sur une synchro émulée qui
    // fait CALER le thread UI pendant le rendu vidéo continu (overlay saccadé en
    // lecture, fluide en pause). Si un setup ancien recrash « Error 71 » au
    // démarrage, l'utilisateur peut poser cette variable lui-même (doc Tauri
    // « Linux Graphics Issues »).

    // En release, stderr est supprimé (windows_subsystem = "windows") : sans ça, une
    // panique Rust disparaîtrait sans laisser de trace.
    #[cfg(target_os = "windows")]
    win_freeze_probe::install_panic_logger();

    // Pas de tauri-plugin-updater : macOS est distribué via le Mac App Store
    // (MAJ gérées par l'App Store) et Windows via le Microsoft Store (MSIX).
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        // Sélecteur de dossier natif (emplacement des téléchargements) —
        // masqué côté UI sur le build Mac App Store (pas d'entitlement fichiers).
        .plugin(tauri_plugin_dialog::init())
        // Cache de la racine de téléchargements. Les affiches/méta/trickplay
        // locaux sont servis à la webview par un serveur HTTP loopback
        // (downloads::localserver, démarré à la 1re demande d'URL locale).
        .manage(downloads::fsops::RootCache::default())
        .manage(downloads::engine::Engine::new());

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

    // Windows: mpv embarqué via tauri-plugin-libmpv (`--wid`, fenêtre enfant que
    // WebView2 sait composer). Linux et macOS utilisent leur Render API custom
    // (src/linux, src/macos) — WebKitGTK/WKWebView ne composent pas une fenêtre
    // vidéo native transparente.
    #[cfg(target_os = "windows")]
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
                downloads::commands::session_cache_get,
                downloads::commands::session_cache_set,
                downloads::commands::session_cache_clear,
                downloads::commands::avatar_cache_put,
                downloads::commands::avatar_cache_get,
                downloads::commands::downloads_get_root,
                downloads::commands::downloads_set_root,
                downloads::commands::downloads_disk_free,
                downloads::commands::downloads_asset_base,
                downloads::commands::downloads_disk_usage,
                downloads::engine_commands::downloads_engine_start,
                downloads::engine_commands::downloads_enqueue,
                downloads::engine_commands::downloads_pause,
                downloads::engine_commands::downloads_resume,
                downloads::engine_commands::downloads_cancel,
                downloads::engine_commands::downloads_delete,
                downloads::engine_commands::downloads_list,
                downloads::engine_commands::downloads_state_for_item,
                downloads::engine_commands::downloads_set_auto_delete,
                downloads::commands::downloads_local_source,
                downloads::commands::downloads_playback_set,
                downloads::commands::downloads_reports_pending,
                downloads::commands::downloads_reports_mark_synced,
                downloads::commands::downloads_purge_due,
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
                downloads::commands::session_cache_get,
                downloads::commands::session_cache_set,
                downloads::commands::session_cache_clear,
                downloads::commands::avatar_cache_put,
                downloads::commands::avatar_cache_get,
                downloads::commands::downloads_get_root,
                downloads::commands::downloads_set_root,
                downloads::commands::downloads_disk_free,
                downloads::commands::downloads_asset_base,
                downloads::commands::downloads_disk_usage,
                downloads::engine_commands::downloads_engine_start,
                downloads::engine_commands::downloads_enqueue,
                downloads::engine_commands::downloads_pause,
                downloads::engine_commands::downloads_resume,
                downloads::engine_commands::downloads_cancel,
                downloads::engine_commands::downloads_delete,
                downloads::engine_commands::downloads_list,
                downloads::engine_commands::downloads_state_for_item,
                downloads::engine_commands::downloads_set_auto_delete,
                downloads::commands::downloads_local_source,
                downloads::commands::downloads_playback_set,
                downloads::commands::downloads_reports_pending,
                downloads::commands::downloads_reports_mark_synced,
                downloads::commands::downloads_purge_due,
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
                downloads::commands::session_cache_get,
                downloads::commands::session_cache_set,
                downloads::commands::session_cache_clear,
                downloads::commands::avatar_cache_put,
                downloads::commands::avatar_cache_get,
                downloads::commands::downloads_get_root,
                downloads::commands::downloads_set_root,
                downloads::commands::downloads_disk_free,
                downloads::commands::downloads_asset_base,
                downloads::commands::downloads_disk_usage,
                downloads::engine_commands::downloads_engine_start,
                downloads::engine_commands::downloads_enqueue,
                downloads::engine_commands::downloads_pause,
                downloads::engine_commands::downloads_resume,
                downloads::engine_commands::downloads_cancel,
                downloads::engine_commands::downloads_delete,
                downloads::engine_commands::downloads_list,
                downloads::engine_commands::downloads_state_for_item,
                downloads::engine_commands::downloads_set_auto_delete,
                downloads::commands::downloads_local_source,
                downloads::commands::downloads_playback_set,
                downloads::commands::downloads_reports_pending,
                downloads::commands::downloads_reports_mark_synced,
                downloads::commands::downloads_purge_due,
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
        // Render API custom : mpv dessine dans un GtkGLArea, la webview
        // WebKitGTK transparente est reparentée par-dessus (cf. src/linux).
        let mpv_lib = linux::MpvLib::load().expect("Failed to load libmpv");
        let render_state = std::sync::Arc::new(linux::RenderState::new(mpv_lib));

        builder = builder
            .manage(render_state)
            .manage(linux::sleep_inhibit::SleepInhibit::new())
            .setup(|app| {
                use tauri::Manager;
                // libmpv EXIGE LC_NUMERIC=C (sinon parsing des nombres cassé →
                // mpv_create échoue). GTK a posé la locale de l'env (ex.
                // fr_CH.UTF-8) ; on rétablit C pour le numérique. Sans impact
                // visible : l'UI est en HTML/WebKit (Intl JS), pas de widget GTK
                // numérique. Après l'init GTK (setup), sur le thread principal.
                unsafe {
                    extern "C" {
                        fn setlocale(
                            category: std::ffi::c_int,
                            locale: *const std::ffi::c_char,
                        ) -> *mut std::ffi::c_char;
                    }
                    // LC_NUMERIC = 1 (glibc & musl).
                    setlocale(1, c"C".as_ptr());
                }
                // Monter l'overlay (reparentage webview au-dessus du GtkGLArea).
                if let Some(window) = app.get_webview_window("main") {
                    let state = app
                        .state::<std::sync::Arc<linux::RenderState>>()
                        .inner()
                        .clone();
                    linux::setup_overlay(&window, state);
                }
                Ok(())
            })
            .invoke_handler(tauri::generate_handler![
                video_surface::toggle_fullscreen,
                video_surface::is_fullscreen,
                video_surface::exit_fullscreen,
                downloads::commands::session_cache_get,
                downloads::commands::session_cache_set,
                downloads::commands::session_cache_clear,
                downloads::commands::avatar_cache_put,
                downloads::commands::avatar_cache_get,
                downloads::commands::downloads_get_root,
                downloads::commands::downloads_set_root,
                downloads::commands::downloads_disk_free,
                downloads::commands::downloads_asset_base,
                downloads::commands::downloads_disk_usage,
                downloads::engine_commands::downloads_engine_start,
                downloads::engine_commands::downloads_enqueue,
                downloads::engine_commands::downloads_pause,
                downloads::engine_commands::downloads_resume,
                downloads::engine_commands::downloads_cancel,
                downloads::engine_commands::downloads_delete,
                downloads::engine_commands::downloads_list,
                downloads::engine_commands::downloads_state_for_item,
                downloads::engine_commands::downloads_set_auto_delete,
                downloads::commands::downloads_local_source,
                downloads::commands::downloads_playback_set,
                downloads::commands::downloads_reports_pending,
                downloads::commands::downloads_reports_mark_synced,
                downloads::commands::downloads_purge_due,
                linux_update::detect::detect_linux_install_format,
                linux_update::install::download_update,
                linux_update::install::install_linux_update,
                linux::commands::mpv_init,
                linux::commands::mpv_command,
                linux::commands::mpv_set_property,
                linux::commands::mpv_get_property,
                linux::commands::mpv_destroy,
                linux::sleep_inhibit::prevent_display_sleep_start,
                linux::sleep_inhibit::prevent_display_sleep_stop,
            ]);
    }

    builder
        .run(tauri::generate_context!())
        .expect("error while running Tentacle desktop");
}
