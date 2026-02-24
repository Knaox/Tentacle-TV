use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

use super::config;

/// Current state of the mpv player, emitted to the frontend.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MpvState {
    pub playing: bool,
    pub position: f64,
    pub duration: f64,
    pub volume: f64,
    pub muted: bool,
    pub paused: bool,
    pub eof: bool,
    pub audio_track: i64,
    pub subtitle_track: i64,
}

impl Default for MpvState {
    fn default() -> Self {
        Self {
            playing: false,
            position: 0.0,
            duration: 0.0,
            volume: 100.0,
            muted: false,
            paused: true,
            eof: false,
            audio_track: 1,
            subtitle_track: 0,
        }
    }
}

/// Track info reported by mpv.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MpvTrack {
    pub id: i64,
    #[serde(rename = "type")]
    pub track_type: String,
    pub title: Option<String>,
    pub lang: Option<String>,
    pub codec: Option<String>,
    pub selected: bool,
}

pub struct MpvPlayer {
    process: Option<Child>,
    ipc_path: String,
    state: Arc<Mutex<MpvState>>,
    request_id: AtomicU64,
    alive: Arc<AtomicBool>,
    #[cfg(target_os = "windows")]
    pipe_writer: Arc<Mutex<Option<Box<dyn Write + Send>>>>,
    #[cfg(not(target_os = "windows"))]
    pipe_writer: Arc<Mutex<Option<std::os::unix::net::UnixStream>>>,
}

impl MpvPlayer {
    pub fn new() -> Self {
        let ipc_path = config::ipc_socket_path();
        Self {
            process: None,
            ipc_path,
            state: Arc::new(Mutex::new(MpvState::default())),
            request_id: AtomicU64::new(1),
            alive: Arc::new(AtomicBool::new(false)),
            pipe_writer: Arc::new(Mutex::new(None)),
        }
    }

    /// Spawn mpv process and connect IPC.
    pub fn start(&mut self, app: AppHandle) -> Result<(), String> {
        if self.alive.load(Ordering::Relaxed) {
            return Ok(());
        }

        let mpv_path = config::mpv_binary_path();
        if !mpv_path.exists() {
            return Err(format!("mpv binary not found at {:?}", mpv_path));
        }

        let args = config::default_mpv_args(&self.ipc_path);

        let child = Command::new(&mpv_path)
            .args(&args)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("Failed to spawn mpv: {}", e))?;

        self.process = Some(child);
        self.alive.store(true, Ordering::Relaxed);

        // Give mpv a moment to create the IPC socket
        std::thread::sleep(std::time::Duration::from_millis(500));

        self.connect_ipc(app)?;
        Ok(())
    }

    /// Connect to the mpv JSON IPC socket.
    fn connect_ipc(&self, app: AppHandle) -> Result<(), String> {
        #[cfg(target_os = "windows")]
        {
            self.connect_ipc_windows(app)
        }
        #[cfg(not(target_os = "windows"))]
        {
            self.connect_ipc_unix(app)
        }
    }

    #[cfg(target_os = "windows")]
    fn connect_ipc_windows(&self, app: AppHandle) -> Result<(), String> {
        use std::fs::OpenOptions;
        use std::os::windows::fs::OpenOptionsExt;

        let pipe_path = &self.ipc_path;
        let mut retries = 10;
        let pipe = loop {
            match OpenOptions::new()
                .read(true)
                .write(true)
                .custom_flags(0) // FILE_FLAG_OVERLAPPED not needed for sync
                .open(pipe_path)
            {
                Ok(f) => break f,
                Err(e) if retries > 0 => {
                    retries -= 1;
                    std::thread::sleep(std::time::Duration::from_millis(200));
                    if retries == 0 {
                        return Err(format!("Failed to connect to mpv pipe: {}", e));
                    }
                }
                Err(e) => return Err(format!("Failed to connect to mpv pipe: {}", e)),
            }
        };

        let reader = pipe.try_clone().map_err(|e| e.to_string())?;
        let writer: Box<dyn Write + Send> = Box::new(pipe);
        *self.pipe_writer.lock().unwrap() = Some(writer);

        // Spawn reader thread
        let state = self.state.clone();
        let alive = self.alive.clone();
        std::thread::spawn(move || {
            let buf = BufReader::new(reader);
            Self::read_ipc_loop(buf, state, alive, app);
        });

        // Observe properties for state updates
        self.observe_properties()?;

        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    fn connect_ipc_unix(&self, app: AppHandle) -> Result<(), String> {
        use std::os::unix::net::UnixStream;

        let mut retries = 10;
        let stream = loop {
            match UnixStream::connect(&self.ipc_path) {
                Ok(s) => break s,
                Err(e) if retries > 0 => {
                    retries -= 1;
                    std::thread::sleep(std::time::Duration::from_millis(200));
                    if retries == 0 {
                        return Err(format!("Failed to connect to mpv socket: {}", e));
                    }
                }
                Err(e) => return Err(format!("Failed to connect to mpv socket: {}", e)),
            }
        };

        let reader = stream.try_clone().map_err(|e| e.to_string())?;
        *self.pipe_writer.lock().unwrap() = Some(stream);

        let state = self.state.clone();
        let alive = self.alive.clone();
        std::thread::spawn(move || {
            let buf = BufReader::new(reader);
            Self::read_ipc_loop(buf, state, alive, app);
        });

        self.observe_properties()?;
        Ok(())
    }

    /// Main IPC read loop — parses mpv events and updates state.
    fn read_ipc_loop<R: std::io::Read>(
        reader: BufReader<R>,
        state: Arc<Mutex<MpvState>>,
        alive: Arc<AtomicBool>,
        app: AppHandle,
    ) {
        for line in reader.lines() {
            let line = match line {
                Ok(l) => l,
                Err(_) => break,
            };
            if line.is_empty() {
                continue;
            }
            let parsed: Value = match serde_json::from_str(&line) {
                Ok(v) => v,
                Err(_) => continue,
            };

            if let Some(event) = parsed.get("event").and_then(|e| e.as_str()) {
                let mut s = state.lock().unwrap();
                match event {
                    "playback-restart" => {
                        s.playing = true;
                        s.eof = false;
                    }
                    "end-file" => {
                        s.playing = false;
                        s.eof = true;
                    }
                    "idle" => {
                        s.playing = false;
                    }
                    _ => {}
                }
                let _ = app.emit("mpv:state", s.clone());
            }

            // Property change events
            if parsed.get("event").and_then(|e| e.as_str()) == Some("property-change") {
                let name = parsed.get("name").and_then(|n| n.as_str()).unwrap_or("");
                let data = parsed.get("data");
                let mut s = state.lock().unwrap();

                match name {
                    "time-pos" => {
                        if let Some(v) = data.and_then(|d| d.as_f64()) {
                            s.position = v;
                        }
                    }
                    "duration" => {
                        if let Some(v) = data.and_then(|d| d.as_f64()) {
                            s.duration = v;
                        }
                    }
                    "pause" => {
                        if let Some(v) = data.and_then(|d| d.as_bool()) {
                            s.paused = v;
                        }
                    }
                    "volume" => {
                        if let Some(v) = data.and_then(|d| d.as_f64()) {
                            s.volume = v;
                        }
                    }
                    "mute" => {
                        if let Some(v) = data.and_then(|d| d.as_bool()) {
                            s.muted = v;
                        }
                    }
                    "aid" => {
                        if let Some(v) = data.and_then(|d| d.as_i64()) {
                            s.audio_track = v;
                        }
                    }
                    "sid" => {
                        if let Some(v) = data.and_then(|d| d.as_i64()) {
                            s.subtitle_track = v;
                        }
                    }
                    _ => {}
                }

                let _ = app.emit("mpv:state", s.clone());
            }
        }

        alive.store(false, Ordering::Relaxed);
    }

    /// Observe mpv properties so we get change events.
    fn observe_properties(&self) -> Result<(), String> {
        let props = [
            "time-pos", "duration", "pause", "volume",
            "mute", "aid", "sid",
        ];
        for (i, prop) in props.iter().enumerate() {
            self.send_command(json!({
                "command": ["observe_property", i + 1, prop],
            }))?;
        }
        Ok(())
    }

    /// Send a JSON command to mpv via IPC.
    pub fn send_command(&self, mut cmd: Value) -> Result<Value, String> {
        let id = self.request_id.fetch_add(1, Ordering::Relaxed);
        cmd.as_object_mut()
            .ok_or("Invalid command")?
            .insert("request_id".into(), json!(id));

        let mut payload = serde_json::to_string(&cmd).map_err(|e| e.to_string())?;
        payload.push('\n');

        let mut writer = self.pipe_writer.lock().unwrap();
        if let Some(ref mut w) = *writer {
            w.write_all(payload.as_bytes()).map_err(|e| e.to_string())?;
            w.flush().map_err(|e| e.to_string())?;
        } else {
            return Err("IPC not connected".into());
        }

        Ok(json!({"request_id": id}))
    }

    pub fn get_state(&self) -> MpvState {
        self.state.lock().unwrap().clone()
    }

    pub fn is_alive(&self) -> bool {
        self.alive.load(Ordering::Relaxed)
    }

    /// Kill the mpv process.
    pub fn stop(&mut self) {
        self.alive.store(false, Ordering::Relaxed);
        let _ = self.send_command(json!({"command": ["quit"]}));
        if let Some(ref mut child) = self.process {
            let _ = child.kill();
            let _ = child.wait();
        }
        self.process = None;
        *self.pipe_writer.lock().unwrap() = None;
        *self.state.lock().unwrap() = MpvState::default();

        // Clean up unix socket
        #[cfg(not(target_os = "windows"))]
        {
            let _ = std::fs::remove_file(&self.ipc_path);
        }
    }
}

impl Drop for MpvPlayer {
    fn drop(&mut self) {
        self.stop();
    }
}
