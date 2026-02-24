use std::path::PathBuf;

/// Resolve the path to the bundled mpv binary.
/// In dev, looks in src-tauri/binaries/
/// In production, uses Tauri's sidecar resolution.
pub fn mpv_binary_path() -> PathBuf {
    // Tauri resolves sidecars at runtime via the sidecar API.
    // This provides a fallback for development.
    let dev_path = std::env::current_dir()
        .unwrap_or_default()
        .join("binaries")
        .join(mpv_binary_name());

    if dev_path.exists() {
        return dev_path;
    }

    // In production, Tauri places sidecars next to the main binary
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.to_path_buf()))
        .unwrap_or_default();

    exe_dir.join(mpv_binary_name())
}

fn mpv_binary_name() -> &'static str {
    if cfg!(target_os = "windows") {
        "mpv.exe"
    } else if cfg!(target_os = "macos") {
        "mpv"
    } else {
        "mpv"
    }
}

/// Default mpv arguments for embedded playback.
pub fn default_mpv_args(ipc_path: &str) -> Vec<String> {
    vec![
        format!("--input-ipc-server={}", ipc_path),
        "--idle=yes".into(),
        "--force-window=no".into(),
        "--no-terminal".into(),
        "--keep-open=yes".into(),
        "--vo=gpu".into(),
        "--hwdec=auto-safe".into(),
        "--hr-seek=yes".into(),
        "--sub-auto=fuzzy".into(),
        "--msg-level=all=no".into(),
    ]
}

/// Generate a unique IPC pipe/socket path.
pub fn ipc_socket_path() -> String {
    if cfg!(target_os = "windows") {
        format!(r"\\.\pipe\tentacle-mpv-{}", std::process::id())
    } else {
        format!("/tmp/tentacle-mpv-{}.sock", std::process::id())
    }
}
