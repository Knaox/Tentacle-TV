// Schéma de la base locale, palier par palier — COPIE OCTET POUR OCTET de
// `packages/offline-core/src/core/schema.ts` (la base est PARTAGÉE avec Electron et, avant
// lui, l'app Tauri : `tentacle-local.db`, même dossier). En changer un caractère rendrait
// invisibles les films déjà gardés. `schema_tests.cpp` compare ce fichier au TypeScript.

#include "offline/core/schema.h"

namespace tentacle::offline {
namespace {

// v1 — cache de session hors ligne et paramètres locaux.
constexpr const char* kV1 = R"SQL(
CREATE TABLE IF NOT EXISTS session_cache (
  jellyfin_user_id TEXT PRIMARY KEY,
  profile_json     TEXT NOT NULL,
  policy_json      TEXT,
  cached_at        INTEGER NOT NULL,
  expires_at       INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
)SQL";

// v2 — schéma des téléchargements.
constexpr const char* kV2 = R"SQL(
CREATE TABLE IF NOT EXISTS files (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id          TEXT NOT NULL,
  media_source_id  TEXT NOT NULL,
  variant          TEXT NOT NULL CHECK (variant IN ('original','light')),
  preset           TEXT,
  rel_path         TEXT NOT NULL,
  expected_size    INTEGER,
  bytes_done       INTEGER NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'queued'
                   CHECK (status IN ('queued','downloading','paused','complete','error','canceled')),
  error_code       TEXT,
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS files_identity
  ON files (item_id, media_source_id, variant, COALESCE(preset, ''));

CREATE TABLE IF NOT EXISTS claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jellyfin_user_id TEXT NOT NULL,
  file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  auto_delete_after_watch INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  UNIQUE (jellyfin_user_id, file_id)
);
CREATE INDEX IF NOT EXISTS claims_by_user ON claims (jellyfin_user_id);

CREATE TABLE IF NOT EXISTS item_meta (
  item_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('movie','episode')),
  series_id TEXT,
  season_id TEXT,
  library_id TEXT,
  runtime_ticks INTEGER,
  images_state TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS playback_state (
  jellyfin_user_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  position_ticks INTEGER NOT NULL DEFAULT 0,
  played INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (jellyfin_user_id, item_id)
);

CREATE TABLE IF NOT EXISTS report_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jellyfin_user_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  position_ticks INTEGER NOT NULL,
  played INTEGER NOT NULL DEFAULT 0,
  occurred_at_utc INTEGER NOT NULL,
  synced INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS report_queue_pending ON report_queue (synced, jellyfin_user_id);
)SQL";

// v3 — pause utilisateur / pause système, titres dénormalisés.
constexpr const char* kV3 = R"SQL(
ALTER TABLE files ADD COLUMN paused_by_user INTEGER NOT NULL DEFAULT 0;
ALTER TABLE item_meta ADD COLUMN title TEXT;
ALTER TABLE item_meta ADD COLUMN series_name TEXT;
)SQL";

// v4 — mode Allégé : piste audio, sous-titre incrusté, side-cars.
constexpr const char* kV4 = R"SQL(
ALTER TABLE files ADD COLUMN audio_stream_index INTEGER;
ALTER TABLE files ADD COLUMN burn_subtitle_index INTEGER;
ALTER TABLE files ADD COLUMN subtitles_json TEXT;
)SQL";

// v5 — numéros de saison et d'épisode dénormalisés.
constexpr const char* kV5 = R"SQL(
ALTER TABLE item_meta ADD COLUMN index_number INTEGER;
ALTER TABLE item_meta ADD COLUMN parent_index_number INTEGER;
)SQL";

// v6 — version du CONTENU du snapshot.
constexpr const char* kV6 = R"SQL(
ALTER TABLE item_meta ADD COLUMN meta_version INTEGER NOT NULL DEFAULT 0;
)SQL";

// v7 — auto-suppression DIFFÉRÉE des vus.
constexpr const char* kV7 = R"SQL(
ALTER TABLE claims ADD COLUMN auto_delete_delay_minutes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE claims ADD COLUMN delete_scheduled_at INTEGER;
)SQL";

// v8 — bibliothèque d'origine NOMMÉE.
constexpr const char* kV8 = R"SQL(
ALTER TABLE item_meta ADD COLUMN library_name TEXT;
ALTER TABLE item_meta ADD COLUMN library_type TEXT;
)SQL";

// v9 — tentatives, relances, étape (`phase`, sans CHECK).
constexpr const char* kV9 = R"SQL(
ALTER TABLE files ADD COLUMN retry_count   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE files ADD COLUMN last_error_at INTEGER;
ALTER TABLE files ADD COLUMN next_retry_at INTEGER;
ALTER TABLE files ADD COLUMN phase         TEXT;
)SQL";

// v10 — side-cars réellement sur le disque.
constexpr const char* kV10 = R"SQL(
ALTER TABLE files ADD COLUMN subtitles_done INTEGER;
)SQL";

// v11 — la MUSIQUE (Octave) dans le même moteur que les films.
constexpr const char* kV11 = R"SQL(
ALTER TABLE files ADD COLUMN source_path TEXT;

CREATE TABLE IF NOT EXISTS music_meta (
  item_id      TEXT PRIMARY KEY,
  track_key    TEXT NOT NULL,
  origin       TEXT NOT NULL,
  title        TEXT NOT NULL,
  artist       TEXT,
  album        TEXT,
  album_key    TEXT,
  disc_number  INTEGER,
  track_number INTEGER,
  duration_ms  INTEGER,
  artwork_path TEXT,
  cover_rel    TEXT,
  track_json   TEXT NOT NULL,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS music_meta_track_key ON music_meta (track_key);

CREATE TABLE IF NOT EXISTS music_collections (
  jellyfin_user_id TEXT NOT NULL,
  collection_key   TEXT NOT NULL,
  kind             TEXT NOT NULL,
  title            TEXT NOT NULL,
  subtitle         TEXT,
  cover_item_id    TEXT,
  track_keys_json  TEXT NOT NULL,
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL,
  PRIMARY KEY (jellyfin_user_id, collection_key)
);
)SQL";

}  // namespace

const std::vector<std::string>& migrations() {
  // L'INDEX vaut la version : le palier 0 amène à `user_version = 1`. Jamais réordonner.
  static const std::vector<std::string> list = {kV1, kV2, kV3, kV4, kV5, kV6,
                                                kV7, kV8, kV9, kV10, kV11};
  return list;
}

int schemaVersion() { return static_cast<int>(migrations().size()); }

}  // namespace tentacle::offline
