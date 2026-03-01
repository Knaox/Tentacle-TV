use tauri::{command, AppHandle, Manager};

/// Toggle fullscreen mode for the Tauri window.
#[command]
pub async fn toggle_fullscreen(app: AppHandle) -> Result<bool, String> {
    let window = app
        .get_webview_window("main")
        .ok_or("Window 'main' not found")?;

    let is_fullscreen = window.is_fullscreen().unwrap_or(false);
    window
        .set_fullscreen(!is_fullscreen)
        .map_err(|e| format!("Failed to toggle fullscreen: {e}"))?;

    Ok(!is_fullscreen)
}

/// Get current fullscreen state.
#[command]
pub async fn is_fullscreen(app: AppHandle) -> Result<bool, String> {
    let window = app
        .get_webview_window("main")
        .ok_or("Window 'main' not found")?;

    Ok(window.is_fullscreen().unwrap_or(false))
}
