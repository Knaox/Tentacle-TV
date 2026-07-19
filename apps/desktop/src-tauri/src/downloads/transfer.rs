//! Boucle de transfert d'UN fichier — thread dédié, streaming HTTP → `.part`
//! → fsync → rename atomique. Reprise par Range pour l'Original (le backend
//! relaie `Accept-Ranges` de Jellyfin) ; l'Allégé (transcode) repart toujours
//! de zéro. Token transmis en HEADER uniquement, jamais persisté.

use std::io::{ErrorKind, Read, Seek, SeekFrom, Write};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};

pub struct TransferFlags {
    pub cancel: AtomicBool,
    pub pause: AtomicBool,
}

impl TransferFlags {
    pub fn new() -> Self {
        Self { cancel: AtomicBool::new(false), pause: AtomicBool::new(false) }
    }
}

pub enum TransferEnd {
    Complete { final_size: i64 },
    Paused { bytes_done: i64 },
    Canceled,
    /// Codes stables : network | disk-full | integrity | unavailable | io
    Failed { code: &'static str, bytes_done: i64 },
}

pub struct TransferJob {
    pub url: String,
    pub token: String,
    pub final_path: PathBuf,
    pub variant: String,
    pub expected_size: Option<i64>,
}

const BUF_SIZE: usize = 256 * 1024;
const PERSIST_EVERY_BYTES: i64 = 4 * 1024 * 1024;
const PERSIST_EVERY: Duration = Duration::from_millis(700);

fn build_agent() -> ureq::Agent {
    ureq::AgentBuilder::new()
        .timeout_connect(Duration::from_secs(10))
        // Détection de flux mort : 30 s sans octet → erreur réseau → pause
        // système reprise automatiquement au retour du réseau.
        .timeout_read(Duration::from_secs(30))
        .timeout_write(Duration::from_secs(30))
        .build()
}

/// `on_progress(bytes_done)` est appelé au fil de l'eau (déjà throttlé ici).
pub fn run(job: &TransferJob, flags: &TransferFlags, on_progress: &dyn Fn(i64)) -> TransferEnd {
    let part_path = {
        let mut os = job.final_path.clone().into_os_string();
        os.push(".part");
        PathBuf::from(os)
    };
    if let Some(parent) = job.final_path.parent() {
        if std::fs::create_dir_all(parent).is_err() {
            return TransferEnd::Failed { code: "io", bytes_done: 0 };
        }
    }

    // Reprise : Original uniquement (le transcode n'est pas rejouable).
    let mut start: i64 = if job.variant == "original" {
        std::fs::metadata(&part_path).map(|m| m.len() as i64).unwrap_or(0)
    } else {
        let _ = std::fs::remove_file(&part_path);
        0
    };

    let agent = build_agent();
    let mut request = agent
        .get(&job.url)
        .set("Authorization", &format!("Bearer {}", job.token));
    if start > 0 {
        request = request.set("Range", &format!("bytes={start}-"));
    }

    let response = match request.call() {
        Ok(resp) => resp,
        Err(ureq::Error::Status(code, _)) => {
            let reason = if code == 404 || code == 403 || code == 401 { "unavailable" } else { "network" };
            return TransferEnd::Failed { code: reason, bytes_done: start };
        }
        Err(_) => return TransferEnd::Failed { code: "network", bytes_done: start },
    };

    // 200 alors qu'on demandait une reprise → le serveur a ignoré le Range :
    // on repart de zéro proprement.
    if response.status() == 200 && start > 0 {
        let _ = std::fs::remove_file(&part_path);
        start = 0;
    }

    let mut file = match std::fs::OpenOptions::new().create(true).write(true).open(&part_path) {
        Ok(f) => f,
        Err(_) => return TransferEnd::Failed { code: "io", bytes_done: start },
    };
    if file.seek(SeekFrom::Start(start as u64)).is_err() {
        return TransferEnd::Failed { code: "io", bytes_done: start };
    }

    let mut reader = response.into_reader();
    let mut buf = vec![0u8; BUF_SIZE];
    let mut total = start;
    let mut last_persist_bytes = start;
    let mut last_persist_at = Instant::now();

    loop {
        if flags.cancel.load(Ordering::Relaxed) {
            drop(file);
            let _ = std::fs::remove_file(&part_path);
            return TransferEnd::Canceled;
        }
        if flags.pause.load(Ordering::Relaxed) {
            let _ = file.sync_all();
            return TransferEnd::Paused { bytes_done: total };
        }

        let read = match reader.read(&mut buf) {
            Ok(0) => break,
            Ok(n) => n,
            Err(_) => {
                let _ = file.sync_all();
                return TransferEnd::Failed { code: "network", bytes_done: total };
            }
        };
        if let Err(e) = file.write_all(&buf[..read]) {
            let code = if e.raw_os_error() == Some(28) || e.kind() == ErrorKind::StorageFull {
                "disk-full"
            } else {
                "io"
            };
            let _ = file.sync_all();
            return TransferEnd::Failed { code, bytes_done: total };
        }
        total += read as i64;

        if total - last_persist_bytes >= PERSIST_EVERY_BYTES
            || last_persist_at.elapsed() >= PERSIST_EVERY
        {
            last_persist_bytes = total;
            last_persist_at = Instant::now();
            on_progress(total);
        }
    }

    if file.sync_all().is_err() {
        return TransferEnd::Failed { code: "io", bytes_done: total };
    }
    drop(file);

    // Intégrité : l'Original doit faire EXACTEMENT la taille annoncée par le
    // serveur ; sinon le fichier source a changé en cours de route → repart
    // propre (jamais présenté comme lisible).
    if job.variant == "original" {
        if let Some(expected) = job.expected_size {
            if expected > 0 && total != expected {
                let _ = std::fs::remove_file(&part_path);
                return TransferEnd::Failed { code: "integrity", bytes_done: 0 };
            }
        }
    }
    if total == 0 {
        let _ = std::fs::remove_file(&part_path);
        return TransferEnd::Failed { code: "integrity", bytes_done: 0 };
    }

    if std::fs::rename(&part_path, &job.final_path).is_err() {
        return TransferEnd::Failed { code: "io", bytes_done: total };
    }
    TransferEnd::Complete { final_size: total }
}
