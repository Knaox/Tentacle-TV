//! FORK TENTACLE (voir VENDORED.md) — struct du plugin + opérations FFI.
//!
//! Refonte du verrouillage : le mutex de map n'est plus JAMAIS tenu pendant
//! un appel FFI bloquant (cause du gel capturé en prod le 15.07.2026). La
//! mécanique est dans `instances.rs`, le cycle de vie (init/destroy) dans
//! `lifecycle.rs`.

use log::{info, trace};
use once_cell::sync::OnceCell;
use scopeguard::defer;
use serde::de::DeserializeOwned;
use std::ffi::{c_char, CStr, CString};
use std::path::PathBuf;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

use crate::instances::InstanceMap;
use crate::models::*;
use crate::wrapper::LibmpvWrapper;
use crate::Error;
use crate::Result;

pub fn init<R: Runtime, C: DeserializeOwned>(
    app: &AppHandle<R>,
    _api: PluginApi<R, C>,
) -> crate::Result<Mpv<R>> {
    info!("Plugin registered.");
    let mpv = Mpv {
        app: app.clone(),
        instances: InstanceMap::new(),
        wrapper: OnceCell::new(),
    };
    Ok(mpv)
}

pub struct Mpv<R: Runtime> {
    pub(crate) app: AppHandle<R>,
    pub instances: InstanceMap,
    pub wrapper: OnceCell<LibmpvWrapper>,
}

/// Décode (et libère) la réponse JSON du wrapper. `on_error` fabrique
/// l'erreur du site d'appel (Command/SetProperty/GetProperty).
fn decode_ffi_response(
    wrapper: &LibmpvWrapper,
    result_ptr: *mut c_char,
    on_error: impl FnOnce(String) -> Error,
) -> Result<Option<serde_json::Value>> {
    if result_ptr.is_null() {
        return Err(on_error("FFI call returned null pointer".into()));
    }

    defer! {
        unsafe { wrapper.mpv_wrapper_free(result_ptr) };
    }

    let response_str = unsafe { CStr::from_ptr(result_ptr).to_string_lossy() };
    let response: FfiResponse = serde_json::from_str(&response_str)?;

    if let Some(err) = response.error {
        return Err(on_error(err));
    }
    Ok(response.data)
}

impl<R: Runtime> Mpv<R> {
    pub fn command(
        &self,
        name: &str,
        args: &Vec<serde_json::Value>,
        window_label: &str,
    ) -> Result<()> {
        if args.is_empty() {
            trace!("COMMAND '{}'", name);
        } else {
            trace!("COMMAND '{}' '{:?}'", name, args);
        }

        self.with_instance(window_label, |instance| {
            let wrapper = self.get_wrapper()?;

            let args_string = serde_json::to_string(&args)?;

            let c_name = CString::new(name)?;
            let c_args = CString::new(args_string)?;

            let result_ptr = unsafe {
                wrapper.mpv_wrapper_command(instance.handle, c_name.as_ptr(), c_args.as_ptr())
            };

            decode_ffi_response(wrapper, result_ptr, |message| Error::Command {
                window_label: window_label.to_string(),
                message,
            })?;
            Ok(())
        })
    }

    pub fn set_property(
        &self,
        name: &str,
        value: &serde_json::Value,
        window_label: &str,
    ) -> crate::Result<()> {
        trace!("SET PROPERTY '{}' '{:?}'", name, value);

        self.with_instance(window_label, |instance| {
            let wrapper = self.get_wrapper()?;

            let value_string = serde_json::to_string(value)?;

            let c_name = CString::new(name)?;
            let c_value = CString::new(value_string)?;

            let result_ptr = unsafe {
                wrapper.mpv_wrapper_set_property(instance.handle, c_name.as_ptr(), c_value.as_ptr())
            };

            decode_ffi_response(wrapper, result_ptr, |message| Error::SetProperty {
                window_label: window_label.to_string(),
                message,
            })?;
            Ok(())
        })
    }

    pub fn get_property(
        &self,
        name: String,
        format: String,
        window_label: &str,
    ) -> crate::Result<serde_json::Value> {
        self.with_instance(window_label, |instance| {
            let wrapper = self.get_wrapper()?;

            let c_name = CString::new(name.clone())?;
            let c_format = CString::new(format.as_str())?;

            let result_ptr = unsafe {
                wrapper.mpv_wrapper_get_property(
                    instance.handle,
                    c_name.as_ptr(),
                    c_format.as_ptr(),
                )
            };

            let data = decode_ffi_response(wrapper, result_ptr, |message| Error::GetProperty {
                window_label: window_label.to_string(),
                message,
            })?;

            let value = data.ok_or_else(|| crate::Error::GetProperty {
                window_label: window_label.to_string(),
                message: "FFI response contained no data".to_string(),
            })?;

            trace!("GET PROPERTY '{}' '{:?}'", name, value);
            Ok(value)
        })
    }

    pub fn set_video_margin_ratio(
        &self,
        ratio: VideoMarginRatio,
        window_label: &str,
    ) -> Result<()> {
        trace!("SET VIDEO MARGIN RATIO '{:?}'", ratio);

        let margins = [
            ("video-margin-ratio-left", ratio.left),
            ("video-margin-ratio-right", ratio.right),
            ("video-margin-ratio-top", ratio.top),
            ("video-margin-ratio-bottom", ratio.bottom),
        ];

        for (property, value_option) in margins {
            if let Some(value) = value_option {
                self.set_property(property, &serde_json::json!(value), window_label)?;
            }
        }
        Ok(())
    }

    /// Verrou de map le temps d'un clone d'`Arc` (µs), puis `read()` sur le
    /// slot PENDANT l'appel FFI : l'opération n'exclut que le destroy de SA
    /// propre instance — jamais la map ni les autres instances.
    pub(crate) fn with_instance<F, T>(&self, window_label: &str, operation: F) -> Result<T>
    where
        F: FnOnce(&MpvInstance) -> Result<T>,
    {
        let slot = self.instances.get(window_label).ok_or_else(|| {
            crate::Error::InstanceNotFound(format!(
                "mpv instance for window label '{}' not found",
                window_label
            ))
        })?;

        slot.with_read(|instance| match instance {
            Some(instance) => operation(instance),
            // Slot réservé (création en cours) ou déjà détruit : upstream
            // BLOQUAIT ici sur le mutex global — on répond immédiatement.
            None => Err(crate::Error::InstanceNotFound(format!(
                "mpv instance for window label '{}' not ready",
                window_label
            ))),
        })
    }

    pub(crate) fn get_wrapper(&self) -> Result<&LibmpvWrapper> {
        self.wrapper.get_or_try_init(|| {
            info!("libmpv-wrapper not initialized. Trying to load libmpv-wrapper now...");

            #[cfg(target_os = "windows")]
            let lib_name = "libmpv-wrapper.dll";
            #[cfg(target_os = "macos")]
            let lib_name = "libmpv-wrapper.dylib";
            #[cfg(target_os = "linux")]
            let lib_name = "libmpv-wrapper.so";

            let mut search_dirs: Vec<PathBuf> = Vec::new();
            if let Ok(exe_path) = std::env::current_exe() {
                if let Some(exe_dir) = exe_path.parent() {
                    search_dirs.push(exe_dir.to_path_buf());
                    search_dirs.push(exe_dir.join("lib"));
                }
            }

            let valid_lib_path: String = search_dirs
                .iter()
                .map(|dir| dir.join(lib_name))
                .find(|path| path.exists())
                .map(|path| path.to_string_lossy().into_owned())
                .unwrap_or_else(|| lib_name.to_string());

            info!("Attempting to load libmpv-wrapper from: {}", valid_lib_path);
            let result = unsafe { LibmpvWrapper::new(&valid_lib_path) };

            match result {
                Ok(wrapper) => {
                    info!("Successfully loaded libmpv-wrapper.");
                    Ok(wrapper)
                }
                Err(e) => Err(Error::FFI(format!(
                    "Failed to load libmpv-wrapper from '{}'. Error: {:?}",
                    valid_lib_path, e
                ))
                .into()),
            }
        })
    }
}
