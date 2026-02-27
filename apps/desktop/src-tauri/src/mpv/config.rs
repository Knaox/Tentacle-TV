use std::path::PathBuf;

/// Resolve the path to the mpv binary.
/// Search order:
/// 1. Dev path: src-tauri/binaries/mpv(.exe)
/// 2. Tauri sidecar (target triple): next to exe, e.g. mpv-x86_64-pc-windows-msvc.exe
/// 3. Next to executable (plain name)
/// 4. System PATH (mpv installed globally)
pub fn mpv_binary_path() -> Option<PathBuf> {
    // 1. Dev path
    let dev_path = std::env::current_dir()
        .unwrap_or_default()
        .join("binaries")
        .join(mpv_binary_name());
    if dev_path.exists() {
        return Some(dev_path);
    }

    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.to_path_buf()))
        .unwrap_or_default();

    // 2. Tauri sidecar with target triple
    let sidecar_name = format!("mpv-{}{}", target_triple(), exe_extension());
    let sidecar_path = exe_dir.join(&sidecar_name);
    if sidecar_path.exists() {
        return Some(sidecar_path);
    }

    // 3. Plain name next to executable
    let plain_path = exe_dir.join(mpv_binary_name());
    if plain_path.exists() {
        return Some(plain_path);
    }

    // 4. System PATH
    if let Ok(output) = std::process::Command::new(which_cmd())
        .arg("mpv")
        .output()
    {
        if output.status.success() {
            let path_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path_str.is_empty() {
                let p = PathBuf::from(&path_str);
                if p.exists() {
                    return Some(p);
                }
            }
        }
    }

    None
}

fn mpv_binary_name() -> &'static str {
    if cfg!(target_os = "windows") { "mpv.exe" } else { "mpv" }
}

fn exe_extension() -> &'static str {
    if cfg!(target_os = "windows") { ".exe" } else { "" }
}

fn which_cmd() -> &'static str {
    if cfg!(target_os = "windows") { "where" } else { "which" }
}

fn target_triple() -> &'static str {
    if cfg!(all(target_os = "windows", target_arch = "x86_64")) {
        "x86_64-pc-windows-msvc"
    } else if cfg!(all(target_os = "windows", target_arch = "aarch64")) {
        "aarch64-pc-windows-msvc"
    } else if cfg!(all(target_os = "macos", target_arch = "x86_64")) {
        "x86_64-apple-darwin"
    } else if cfg!(all(target_os = "macos", target_arch = "aarch64")) {
        "aarch64-apple-darwin"
    } else if cfg!(all(target_os = "linux", target_arch = "x86_64")) {
        "x86_64-unknown-linux-gnu"
    } else {
        "unknown"
    }
}

/// Default mpv arguments for embedded playback.
/// When `wid` is provided, mpv renders into the given window handle (overlay mode).
pub fn default_mpv_args(ipc_path: &str, wid: Option<i64>) -> Vec<String> {
    let mut args = vec![
        format!("--input-ipc-server={}", ipc_path),
        "--idle=yes".into(),
        "--no-terminal".into(),
        "--keep-open=yes".into(),
        "--vo=gpu".into(),
        "--hwdec=auto-safe".into(),
        "--hr-seek=yes".into(),
        "--sub-auto=fuzzy".into(),
        "--msg-level=all=no".into(),
        "--osc=no".into(),
        "--input-default-bindings=no".into(),
        "--input-vo-keyboard=no".into(),
        "--cache=yes".into(),
        "--demuxer-max-bytes=150MiB".into(),
        "--demuxer-max-back-bytes=75MiB".into(),
    ];
    if let Some(handle) = wid {
        args.push(format!("--wid={}", handle));
    } else {
        args.push("--force-window=no".into());
    }
    args
}

/// Generate a unique IPC pipe/socket path.
pub fn ipc_socket_path() -> String {
    if cfg!(target_os = "windows") {
        format!(r"\\.\pipe\tentacle-mpv-{}", std::process::id())
    } else {
        format!("/tmp/tentacle-mpv-{}.sock", std::process::id())
    }
}
