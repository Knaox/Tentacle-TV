//! FORK TENTACLE (voir VENDORED.md) — cycle de vie des instances mpv.
//!
//! `init` réserve le label sous verrou court, exécute `mpv_wrapper_create`
//! HORS verrou (upstream le tenait pendant TOUTE la création — plusieurs
//! secondes), puis pose l'instance. `destroy` retire le slot de la map
//! (verrou court) puis attend en arrière-plan (`write()` sur le slot) la fin
//! des opérations en vol sur CETTE instance uniquement — auto-réparateur : si
//! une opération coincée dans mpv finit par lâcher, le démontage s'achève et
//! l'audio zombie s'arrête tout seul.

use log::{error, info, trace};
use raw_window_handle::HasWindowHandle;
use std::ffi::{c_char, c_void, CStr, CString};
use tauri::{Emitter, Manager, Runtime};

use crate::desktop::Mpv;
use crate::models::*;
use crate::utils::get_wid;
use crate::Result;

pub unsafe extern "C" fn event_callback<R: Runtime>(event: *const c_char, userdata: *mut c_void) {
    if event.is_null() || userdata.is_null() {
        return;
    }

    let data = unsafe { &*(userdata as *const EventUserData<R>) };

    // Clonés AVANT le spawn : upstream déplaçait des références au userdata
    // dans une tâche 'static (use-after-free possible si destroy libérait le
    // Box pendant que la tâche courait encore).
    let app = data.app.clone();
    let window_label = data.window_label.clone();
    let free_fn = data.free_fn;

    let event_string = unsafe { CStr::from_ptr(event).to_string_lossy().to_string() };

    unsafe {
        free_fn(event as *mut c_char);
    }

    tauri::async_runtime::spawn(async move {
        match serde_json::from_str::<serde_json::Value>(&event_string) {
            Ok(event) => {
                let event_name = format!("mpv-event-{}", window_label);
                if let Err(e) = app.emit_to(&window_label, &event_name, &event) {
                    error!("Failed to emit mpv event to frontend: {}", e);
                }
            }
            Err(e) => {
                error!("Failed to deserialize mpv FFI event: {}", e);
            }
        }
    });
}

impl<R: Runtime> Mpv<R> {
    pub fn init(&self, mpv_config: MpvConfig, window_label: &str) -> Result<String> {
        self.init_wid_mode(mpv_config, window_label)?;
        Ok(window_label.to_string())
    }

    fn init_wid_mode(&self, mpv_config: MpvConfig, window_label: &str) -> Result<String> {
        let app = self.app.clone();

        let wrapper = self.get_wrapper()?;

        let free_fn = wrapper.mpv_wrapper_free;

        let mut initial_options = mpv_config.initial_options.clone();

        let audio_only = initial_options.iter().any(|(key, value)| {
            (key == "video" && (value == "no" || value == false))
                || (key == "vid" && (value == "no" || value == false))
        });

        if audio_only {
            info!(
                "Audio-only mode detected for window '{}'. Skipping window embedding.",
                window_label
            );
        }

        if !audio_only && !initial_options.contains_key("wid") {
            let wid_result = (|| -> crate::Result<i64> {
                let window = self
                    .app
                    .get_webview_window(window_label)
                    .ok_or_else(|| crate::Error::WindowNotFound(window_label.to_string()))?;
                let window_handle = window.window_handle()?;
                let raw_window_handle = window_handle.as_raw();
                get_wid(raw_window_handle)
            })();

            match wid_result {
                Ok(wid) => {
                    initial_options.insert("wid".to_string(), serde_json::json!(wid));
                }
                Err(e) => {
                    error!(
                        "Failed to get wid for window '{}': {}. Skipping window embedding.",
                        window_label, e
                    );
                }
            }
        }

        let initial_options_string = serde_json::to_string(&initial_options)?;
        let observed_properties_string = serde_json::to_string(&mpv_config.observed_properties)?;

        let c_initial_options = CString::new(initial_options_string)?;
        let c_observed_properties = CString::new(observed_properties_string)?;

        // Réservation du label sous verrou court — la création FFI (lente :
        // fenêtre, VO, AO…) se fait HORS verrou. Pendant ce temps, les
        // commandes sur ce label reçoivent `InstanceNotFound` au lieu de
        // s'empiler (le frontend n'envoie rien avant la résolution d'init).
        let Some(slot) = self.instances.reserve(window_label) else {
            info!(
                "mpv instance for window '{}' already exists. Skipping initialization.",
                window_label
            );
            return Ok(window_label.to_string());
        };

        let event_callback_data = Box::new(EventUserData {
            app,
            free_fn,
            window_label: window_label.to_string(),
        });
        let event_userdata = Box::into_raw(event_callback_data) as *mut c_void;

        let mpv_handle = unsafe {
            wrapper.mpv_wrapper_create(
                c_initial_options.as_ptr(),
                c_observed_properties.as_ptr(),
                Some(event_callback::<R>),
                event_userdata,
            )
        };

        if mpv_handle.is_null() {
            // Upstream libérait ce Box sous un mauvais type ((AppHandle,
            // String) au lieu d'EventUserData<R>) — corrigé.
            let _ = unsafe { Box::from_raw(event_userdata as *mut EventUserData<R>) };
            self.instances.cancel_reservation(window_label, &slot);
            return Err(crate::Error::CreateInstance);
        }

        info!("mpv instance initialized for window '{}'.", window_label);

        let fulfilled = slot.fulfill(MpvInstance {
            handle: mpv_handle,
            event_userdata,
        });

        if !fulfilled {
            // Un destroy est arrivé PENDANT la création (le slot n'est plus
            // dans la map) : démonter tout de suite l'instance orpheline —
            // même état final qu'upstream (créée, puis détruite).
            unsafe {
                wrapper.mpv_wrapper_destroy(mpv_handle);
            }
            let _ = unsafe { Box::from_raw(event_userdata as *mut EventUserData<R>) };
            info!(
                "mpv instance for window '{}' was destroyed during creation.",
                window_label
            );
            return Ok(window_label.to_string());
        }

        info!("Wid mode initialized for window '{}'.", window_label);

        Ok(window_label.to_string())
    }

    pub fn destroy(&self, window_label: &str) -> Result<()> {
        let slot = self.instances.remove(window_label);

        if let Some(slot) = slot {
            // `take_for_destroy` attend (`write()`) la fin des opérations FFI
            // en vol sur CETTE instance uniquement. Si l'une d'elles est
            // coincée dans mpv, seul CE thread destroy patiente — la map, le
            // thread UI et un ré-init du même label restent libres — et il
            // achèvera le démontage dès que l'opération lâchera.
            if let Some(instance) = slot.take_for_destroy() {
                let wrapper = self.get_wrapper()?;

                unsafe {
                    wrapper.mpv_wrapper_destroy(instance.handle);
                }

                let _ = unsafe { Box::from_raw(instance.event_userdata as *mut EventUserData<R>) };

                info!(
                    "mpv instance for window '{}' has been destroyed.",
                    window_label,
                );
                return Ok(());
            }
        }

        trace!(
            "No running mpv instance found for window '{}' to destroy.",
            window_label
        );
        Ok(())
    }
}
