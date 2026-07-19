//! Orchestrateur des transferts : 2 téléchargements simultanés max, FIFO,
//! reprise au démarrage (pauses SYSTÈME uniquement), pause/reprise/annulation.
//! Les identifiants de connexion (serveur + token) vivent EN MÉMOIRE seulement,
//! fournis par le front à chaque session — jamais écrits en base.

use super::{db, fsops, meta, queue, store, transfer};
use serde::Serialize;
use std::collections::HashMap;
use std::sync::{Arc, Mutex, MutexGuard, OnceLock};
use tauri::{AppHandle, Emitter};

pub const MAX_PARALLEL: usize = 2;
pub const EVENT_PROGRESS: &str = "downloads://progress";
pub const EVENT_CHANGED: &str = "downloads://changed";

#[derive(Clone)]
pub struct Creds {
    pub server_url: String,
    pub token: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ProgressPayload {
    file_id: i64,
    bytes_done: i64,
    expected_size: Option<i64>,
}

pub struct Engine {
    inner: Arc<EngineInner>,
}

impl Clone for Engine {
    fn clone(&self) -> Self {
        Self { inner: self.inner.clone() }
    }
}

struct EngineInner {
    app: OnceLock<AppHandle>,
    creds: Mutex<Option<Creds>>,
    active: Mutex<HashMap<i64, Arc<transfer::TransferFlags>>>,
}

fn lock<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    match mutex.lock() {
        Ok(guard) => guard,
        Err(poisoned) => poisoned.into_inner(),
    }
}

pub fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

impl Default for Engine {
    fn default() -> Self {
        Self::new()
    }
}

impl Engine {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(EngineInner {
                app: OnceLock::new(),
                creds: Mutex::new(None),
                active: Mutex::new(HashMap::new()),
            }),
        }
    }

    fn app(&self) -> Option<AppHandle> {
        self.inner.app.get().cloned()
    }

    fn emit_changed(&self) {
        if let Some(app) = self.app() {
            let _ = app.emit(EVENT_CHANGED, ());
        }
    }

    pub fn is_active(&self, file_id: i64) -> bool {
        lock(&self.inner.active).contains_key(&file_id)
    }

    /// Notification « quelque chose a changé » vers l'UI (listes à invalider).
    pub fn notify_changed(&self) {
        self.emit_changed();
    }

    /// Démarrage/reconnexion : pose les credentials, normalise la file
    /// (interrompus + pauses système → queued) et relance.
    pub fn start(&self, app: &AppHandle, creds: Creds) -> Result<(), String> {
        let _ = self.inner.app.set(app.clone());
        *lock(&self.inner.creds) = Some(creds);
        let conn = db::open(&db::db_path(app)?)?;
        queue::normalize_on_engine_start(&conn, now_ms())?;
        drop(conn);
        self.emit_changed();
        self.pump();
        Ok(())
    }

    /// Rafraîchit les credentials sans re-normaliser (enqueue courant).
    pub fn set_creds(&self, app: &AppHandle, creds: Creds) {
        let _ = self.inner.app.set(app.clone());
        *lock(&self.inner.creds) = Some(creds);
    }

    /// Lance des transferts tant qu'il y a des slots ET des fichiers en file.
    pub fn pump(&self) {
        let Some(app) = self.app() else { return };
        let Some(creds) = lock(&self.inner.creds).clone() else { return };
        loop {
            let Ok(db_path) = db::db_path(&app) else { return };
            let Ok(conn) = db::open(&db_path) else { return };
            let mut active = lock(&self.inner.active);
            if active.len() >= MAX_PARALLEL {
                return;
            }
            let Ok(Some(file)) = queue::next_queued(&conn) else { return };
            if queue::set_status(&conn, file.id, "downloading", None, now_ms()).is_err() {
                return;
            }
            let flags = Arc::new(transfer::TransferFlags::new());
            active.insert(file.id, flags.clone());
            drop(active);
            drop(conn);
            self.spawn_worker(app.clone(), creds.clone(), file, flags);
        }
    }

    fn spawn_worker(
        &self,
        app: AppHandle,
        creds: Creds,
        file: store::FileRow,
        flags: Arc<transfer::TransferFlags>,
    ) {
        let engine = self.clone();
        std::thread::spawn(move || {
            let end = run_worker(&app, &creds, &file, &flags);
            engine.finish(&app, file.id, end);
        });
    }

    fn finish(&self, app: &AppHandle, file_id: i64, end: transfer::TransferEnd) {
        lock(&self.inner.active).remove(&file_id);
        if let Ok(path) = db::db_path(app) {
            if let Ok(conn) = db::open(&path) {
                let now = now_ms();
                use transfer::TransferEnd as E;
                let _ = match end {
                    E::Complete { final_size } => {
                        let _ = queue::set_bytes_done(&conn, file_id, final_size, now);
                        queue::set_status(&conn, file_id, "complete", None, now)
                    }
                    E::Paused { bytes_done } => {
                        let _ = queue::set_bytes_done(&conn, file_id, bytes_done, now);
                        queue::set_status(&conn, file_id, "paused", None, now)
                    }
                    E::Canceled => {
                        let _ = queue::set_bytes_done(&conn, file_id, 0, now);
                        queue::set_status(&conn, file_id, "canceled", None, now)
                    }
                    E::Failed { code, bytes_done } => {
                        let _ = queue::set_bytes_done(&conn, file_id, bytes_done, now);
                        if code == "network" {
                            // Coupure réseau = pause SYSTÈME → auto-reprise.
                            let _ = queue::set_paused_by_user(&conn, file_id, false);
                            queue::set_status(&conn, file_id, "paused", None, now)
                        } else {
                            queue::set_status(&conn, file_id, "error", Some(code), now)
                        }
                    }
                };
            }
        }
        self.emit_changed();
        self.pump();
    }

    pub fn pause(&self, app: &AppHandle, file_id: i64) -> Result<(), String> {
        let conn = db::open(&db::db_path(app)?)?;
        queue::set_paused_by_user(&conn, file_id, true)?;
        if let Some(flags) = lock(&self.inner.active).get(&file_id) {
            flags.pause.store(true, std::sync::atomic::Ordering::Relaxed);
        } else if let Some(file) = queue::get_file(&conn, file_id)? {
            if file.status == "queued" {
                queue::set_status(&conn, file_id, "paused", None, now_ms())?;
            }
        }
        self.emit_changed();
        Ok(())
    }

    pub fn resume(&self, app: &AppHandle, file_id: i64) -> Result<(), String> {
        let conn = db::open(&db::db_path(app)?)?;
        if let Some(file) = queue::get_file(&conn, file_id)? {
            if file.status == "paused" || file.status == "error" {
                queue::set_paused_by_user(&conn, file_id, false)?;
                queue::set_status(&conn, file_id, "queued", None, now_ms())?;
            }
        }
        drop(conn);
        self.emit_changed();
        self.pump();
        Ok(())
    }

    pub fn cancel(&self, app: &AppHandle, file_id: i64) -> Result<(), String> {
        if let Some(flags) = lock(&self.inner.active).get(&file_id) {
            flags.cancel.store(true, std::sync::atomic::Ordering::Relaxed);
            return Ok(()); // le worker nettoie le .part et pose le statut
        }
        let conn = db::open(&db::db_path(app)?)?;
        if let Some(file) = queue::get_file(&conn, file_id)? {
            let root = fsops::resolve_root(app)?;
            fsops::remove_media_file(&root, &file.rel_path)?;
            queue::set_bytes_done(&conn, file_id, 0, now_ms())?;
            queue::set_status(&conn, file_id, "canceled", None, now_ms())?;
        }
        self.emit_changed();
        Ok(())
    }

    /// Attend la fin effective d'un worker (suppression de claim sûre).
    pub fn wait_not_active(&self, file_id: i64, timeout_ms: u64) {
        let deadline = std::time::Instant::now() + std::time::Duration::from_millis(timeout_ms);
        while self.is_active(file_id) && std::time::Instant::now() < deadline {
            std::thread::sleep(std::time::Duration::from_millis(50));
        }
    }
}

/// Corps du worker : snapshot méta best-effort puis transfert streaming.
fn run_worker(
    app: &AppHandle,
    creds: &Creds,
    file: &store::FileRow,
    flags: &transfer::TransferFlags,
) -> transfer::TransferEnd {
    let Ok(root) = fsops::resolve_root(app) else {
        return transfer::TransferEnd::Failed { code: "io", bytes_done: file.bytes_done };
    };
    let Ok(db_path) = db::db_path(app) else {
        return transfer::TransferEnd::Failed { code: "io", bytes_done: file.bytes_done };
    };
    let Ok(conn) = db::open(&db_path) else {
        return transfer::TransferEnd::Failed { code: "io", bytes_done: file.bytes_done };
    };

    let agent = ureq::AgentBuilder::new()
        .timeout(std::time::Duration::from_secs(20))
        .build();
    if !meta::snapshot_exists(&root, &file.item_id) {
        if let Ok(Some(spec)) = meta::get_spec(&conn, &file.item_id) {
            let _ = meta::snapshot(&agent, &creds.server_url, &creds.token, &root, &conn, &spec);
        }
    }
    // Sous-titres texte en side-cars (les deux variantes) — best-effort.
    if let Some(json) = &file.subtitles_json {
        let specs = super::subs::parse_specs(json);
        if !specs.is_empty() {
            let _ = super::subs::fetch_all(
                &agent, &creds.server_url, &creds.token, &root,
                &file.item_id, &file.media_source_id, &specs,
            );
        }
    }

    let Ok(final_path) = fsops::safe_join(&root, &file.rel_path) else {
        return transfer::TransferEnd::Failed { code: "io", bytes_done: 0 };
    };
    let url = match file.variant.as_str() {
        "original" => format!(
            "{}/api/downloads/original/{}?mediaSourceId={}",
            creds.server_url, file.item_id, file.media_source_id
        ),
        _ => {
            let mut light_url = format!(
                "{}/api/downloads/light/{}?mediaSourceId={}&preset={}",
                creds.server_url,
                file.item_id,
                file.media_source_id,
                file.preset.as_deref().unwrap_or("p720")
            );
            if let Some(audio) = file.audio_stream_index {
                light_url.push_str(&format!("&audioStreamIndex={audio}"));
            }
            if let Some(burn) = file.burn_subtitle_index {
                light_url.push_str(&format!("&burnSubtitleIndex={burn}"));
            }
            light_url
        }
    };
    let job = transfer::TransferJob {
        url,
        token: creds.token.clone(),
        final_path,
        variant: file.variant.clone(),
        expected_size: file.expected_size,
        server_url: creds.server_url.clone(),
    };
    let app_for_events = app.clone();
    let file_id = file.id;
    let expected = file.expected_size;
    transfer::run(&job, flags, &move |bytes| {
        let _ = queue::set_bytes_done(&conn, file_id, bytes, now_ms());
        let _ = app_for_events.emit(
            EVENT_PROGRESS,
            ProgressPayload { file_id, bytes_done: bytes, expected_size: expected },
        );
    })
}
