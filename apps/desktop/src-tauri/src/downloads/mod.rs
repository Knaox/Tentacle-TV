//! Mode Hors ligne & Téléchargements — socle local (desktop uniquement).
//!
//! Base SQLite locale (rusqlite, WAL) + commandes IPC typées. La base vit dans
//! `app_data_dir` (emplacement FIXE), PAS sous la racine de téléchargements
//! configurable : si l'utilisateur pointe la racine vers un disque externe
//! débranché, l'index et le cache de session doivent rester disponibles pour
//! afficher des états « fichier manquant » plutôt qu'une app amnésique.
//!
//! ⚠️ Aucun secret ici : ni token, ni clé API — le token Jellyfin reste dans le
//! localStorage de la webview (mécanisme existant) et n'est transmis au Rust
//! que par IPC, en mémoire, pour la durée d'une commande.
//!
//! Pas de `Builder::setup` : `main.rs` n'en supporte qu'un par plateforme (un
//! second l'écraserait silencieusement). Chaque commande résout le chemin de la
//! base via son `AppHandle` — ouverture SQLite courte, coût négligeable pour
//! les opérations de session/paramètres.

pub mod commands;
pub mod db;
pub mod engine;
pub mod engine_commands;
pub mod fsops;
pub mod heal;
pub mod listing;
pub mod localserver;
pub mod meta;
pub mod playback;
pub mod queue;
pub mod session;
pub mod store;
pub mod subs;
pub mod transfer;
pub mod trickplay;
