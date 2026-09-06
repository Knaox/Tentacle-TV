/**
 * Schéma de la base locale, palier par palier.
 *
 * ⚠️ **Ces sept blocs sont FIGÉS.** Ce ne sont pas des tables neuves : ce sont
 * celles que l'app Tauri a déjà créées chez chaque utilisateur, dans le même
 * fichier `tentacle-local.db` du même dossier de données. En changer un
 * caractère, c'est rendre invisibles les films déjà téléchargés — ou pire,
 * faire diverger deux applications qui lisent le même fichier.
 *
 * Recopiés de `apps/desktop/src-tauri/src/downloads/db.rs`. Une base
 * d'utilisateur existante est déjà en `user_version = 7` : à l'ouverture, rien
 * ne s'exécute. Ces blocs ne servent qu'à une installation neuve.
 */

/** v1 — cache de session hors ligne et paramètres locaux. */
const SCHEMA_V1 = `
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
`;

/**
 * v2 — schéma des téléchargements.
 *
 * `files` = état PHYSIQUE d'un transfert (partagé entre comptes) ;
 * `claims` = référence PAR utilisateur (le compteur de références est un
 * COUNT) ; `item_meta` = snapshot catalogique ; `playback_state` et
 * `report_queue` = progression locale et resynchronisation différée.
 */
const SCHEMA_V2 = `
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
`;

/**
 * v3 — moteur de téléchargement : distinction pause utilisateur / pause
 * système (coupure réseau, redémarrage) pour l'auto-reprise, et titres
 * dénormalisés dans `item_meta` (lister les téléchargements sans lire N
 * fichiers JSON).
 */
const SCHEMA_V3 = `
ALTER TABLE files ADD COLUMN paused_by_user INTEGER NOT NULL DEFAULT 0;
ALTER TABLE item_meta ADD COLUMN title TEXT;
ALTER TABLE item_meta ADD COLUMN series_name TEXT;
`;

/**
 * v4 — mode Allégé : piste audio choisie, sous-titre incrusté (burn-in) et
 * liste des sous-titres texte à télécharger en side-cars (JSON).
 */
const SCHEMA_V4 = `
ALTER TABLE files ADD COLUMN audio_stream_index INTEGER;
ALTER TABLE files ADD COLUMN burn_subtitle_index INTEGER;
ALTER TABLE files ADD COLUMN subtitles_json TEXT;
`;

/**
 * v5 — numéros de saison et d'épisode dénormalisés : le catalogue hors ligne
 * regroupe et trie les épisodes sans relire N `item.json` sur le disque.
 */
const SCHEMA_V5 = `
ALTER TABLE item_meta ADD COLUMN index_number INTEGER;
ALTER TABLE item_meta ADD COLUMN parent_index_number INTEGER;
`;

/**
 * v6 — version du CONTENU du snapshot : la réparation re-snapshotte les
 * téléchargements antérieurs (DTO enrichi + segments « passer l'intro »
 * persistés pour une lecture locale sans réseau).
 */
const SCHEMA_V6 = `
ALTER TABLE item_meta ADD COLUMN meta_version INTEGER NOT NULL DEFAULT 0;
`;

/**
 * v7 — auto-suppression DIFFÉRÉE des vus : délai par claim (minutes, 0 =
 * immédiat) et échéance absolue (epoch SECONDES) posée au passage « vu » —
 * purgée même si l'application était fermée à l'échéance.
 */
const SCHEMA_V7 = `
ALTER TABLE claims ADD COLUMN auto_delete_delay_minutes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE claims ADD COLUMN delete_scheduled_at INTEGER;
`;

/**
 * Les paliers, dans l'ordre. L'INDEX vaut la version : le palier 0 amène à
 * `user_version = 1`, et ainsi de suite. Ajouter un palier, c'est pousser à la
 * fin de ce tableau — jamais réordonner.
 */
export const MIGRATIONS: readonly string[] = [
  SCHEMA_V1,
  SCHEMA_V2,
  SCHEMA_V3,
  SCHEMA_V4,
  SCHEMA_V5,
  SCHEMA_V6,
  SCHEMA_V7,
];

/** Version de schéma que ce code sait produire et lire. */
export const SCHEMA_VERSION = MIGRATIONS.length;
