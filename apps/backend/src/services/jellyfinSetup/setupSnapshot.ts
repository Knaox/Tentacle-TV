import { jellyfinAdminFetch, type JellyfinFailure } from "../jellyfinAdminFetch";
import { readTrailerCoverage, type TrailerCounts } from "./trailerCoverage";

/**
 * L'état réel du Jellyfin connecté, en une lecture : bibliothèques et leurs
 * options, greffons, configuration du serveur et du transcodage, tâches
 * planifiées, titres sans identifiant TMDB, bandes-annonces comptées. Tout part
 * en parallèle avec la clé
 * d'administration ; une lecture qui échoue vaut `null` et ne rend « inconnu »
 * que le réglage qui en dépend.
 *
 * Les objets restent BRUTS : un geste en un clic renvoie à Jellyfin l'objet
 * qu'il a donné, un seul champ changé (ses écritures de configuration sont des
 * REMPLACEMENTS intégraux — un champ oublié y retomberait à son défaut).
 */

export type Loose = Record<string, unknown>;

export interface SetupSnapshot {
  version: string;
  restartPending: boolean;
  libraries: Loose[] | null;
  plugins: Loose[] | null;
  config: Loose | null;
  encoding: Loose | null;
  tasks: Loose[] | null;
  missingTmdb: number | null;
  trailers: TrailerCounts | null;
}

export type SnapshotRead = { ok: true; snapshot: SetupSnapshot } | { ok: false; failure: JellyfinFailure };

const isRecord = (value: unknown): value is Loose => typeof value === "object" && value !== null && !Array.isArray(value);
const records = (value: unknown): Loose[] | null => (Array.isArray(value) ? value.filter(isRecord) : null);

async function read<T>(path: string, pick: (data: unknown) => T | null): Promise<T | null> {
  const res = await jellyfinAdminFetch(path, { timeoutMs: 8000 });
  return res.ok ? pick(res.data) : null;
}

/** Les films et séries sans identifiant TMDB : ni recommandés, ni reliés à Vigie, ni à leur saga. */
const MISSING_TMDB_PATH = "/Items?Recursive=true&IncludeItemTypes=Movie,Series&HasTmdbId=false&Limit=0";

export async function readSetupSnapshot(): Promise<SnapshotRead> {
  const info = await jellyfinAdminFetch<Loose>("/System/Info");
  if (!info.ok) return { ok: false, failure: info.failure };
  if (!isRecord(info.data) || typeof info.data.Version !== "string") return { ok: false, failure: "invalid" };

  const [libraries, plugins, config, encoding, tasks, missingTmdb, trailers] = await Promise.all([
    read("/Library/VirtualFolders", records),
    read("/Plugins", records),
    read("/System/Configuration", (data) => (isRecord(data) ? data : null)),
    read("/System/Configuration/encoding", (data) => (isRecord(data) ? data : null)),
    read("/ScheduledTasks?isHidden=false", records),
    read(MISSING_TMDB_PATH, (data) => (isRecord(data) && typeof data.TotalRecordCount === "number" ? data.TotalRecordCount : null)),
    readTrailerCoverage(),
  ]);
  return {
    ok: true,
    snapshot: {
      version: info.data.Version,
      restartPending: info.data.HasPendingRestart === true,
      libraries,
      plugins,
      config,
      encoding,
      tasks,
      missingTmdb,
      trailers,
    },
  };
}
