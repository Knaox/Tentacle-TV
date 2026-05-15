// IOPMAssertion wrapper — empêche la mise en veille de l'écran pendant la lecture.
// Sur macOS, mpv utilise vo=libmpv (render API) sans fenêtre native : il ne peut
// donc pas appeler IOPMAssertionCreate lui-même. On expose ici deux commandes
// Tauri pour gérer l'assertion depuis le frontend (start au play, stop au pause/stop).
use std::ffi::{c_char, c_void};
use std::sync::Mutex;

use tauri::{command, State};

#[link(name = "IOKit", kind = "framework")]
#[link(name = "CoreFoundation", kind = "framework")]
extern "C" {
    fn CFStringCreateWithCString(
        alloc: *const c_void,
        c_str: *const c_char,
        encoding: u32,
    ) -> *const c_void;
    fn CFRelease(cf: *const c_void);

    fn IOPMAssertionCreateWithName(
        assertion_type: *const c_void,
        assertion_level: u32,
        assertion_name: *const c_void,
        assertion_id: *mut u32,
    ) -> i32;
    fn IOPMAssertionRelease(assertion_id: u32) -> i32;
}

const KCFSTRING_ENCODING_UTF8: u32 = 0x0800_0100;
const KIOPM_ASSERTION_LEVEL_ON: u32 = 255;
// kIOPMAssertPreventUserIdleDisplaySleep — empêche l'écran de s'éteindre par inactivité.
// L'écran restant allumé, le système ne dort pas non plus.
const ASSERTION_TYPE: &[u8] = b"PreventUserIdleDisplaySleep\0";
const ASSERTION_NAME: &[u8] = b"Tentacle TV - Lecture video en cours\0";

pub struct SleepAssertion {
    id: Mutex<Option<u32>>,
}

impl SleepAssertion {
    pub fn new() -> Self {
        Self { id: Mutex::new(None) }
    }
}

impl Drop for SleepAssertion {
    fn drop(&mut self) {
        if let Ok(mut guard) = self.id.lock() {
            if let Some(id) = guard.take() {
                unsafe { IOPMAssertionRelease(id); }
            }
        }
    }
}

fn make_cf_string(bytes: &[u8]) -> *const c_void {
    unsafe {
        CFStringCreateWithCString(
            std::ptr::null(),
            bytes.as_ptr() as *const c_char,
            KCFSTRING_ENCODING_UTF8,
        )
    }
}

#[command]
pub async fn prevent_display_sleep_start(
    state: State<'_, SleepAssertion>,
) -> Result<(), String> {
    let mut guard = state.id.lock().map_err(|e| e.to_string())?;
    if guard.is_some() {
        return Ok(());
    }

    let type_cf = make_cf_string(ASSERTION_TYPE);
    if type_cf.is_null() {
        return Err("Failed to create assertion type CFString".to_string());
    }
    let name_cf = make_cf_string(ASSERTION_NAME);
    if name_cf.is_null() {
        unsafe { CFRelease(type_cf); }
        return Err("Failed to create assertion name CFString".to_string());
    }

    let mut assertion_id: u32 = 0;
    let result = unsafe {
        IOPMAssertionCreateWithName(
            type_cf,
            KIOPM_ASSERTION_LEVEL_ON,
            name_cf,
            &mut assertion_id,
        )
    };

    unsafe {
        CFRelease(type_cf);
        CFRelease(name_cf);
    }

    if result != 0 {
        return Err(format!("IOPMAssertionCreateWithName failed: {result}"));
    }

    *guard = Some(assertion_id);
    Ok(())
}

#[command]
pub async fn prevent_display_sleep_stop(
    state: State<'_, SleepAssertion>,
) -> Result<(), String> {
    let mut guard = state.id.lock().map_err(|e| e.to_string())?;
    if let Some(id) = guard.take() {
        let result = unsafe { IOPMAssertionRelease(id) };
        if result != 0 {
            return Err(format!("IOPMAssertionRelease failed: {result}"));
        }
    }
    Ok(())
}
