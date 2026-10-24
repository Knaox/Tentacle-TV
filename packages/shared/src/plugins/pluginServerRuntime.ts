/**
 * Le runtime ISOLÉ des modules serveur d'extension (capacité
 * `plugins.isolatedRuntime`) — contrat entre le backend Tentacle (l'HÔTE) et le
 * module d'une extension (l'INVITÉ). docs/octave/CONTRATS.md, § Runtime isolé.
 *
 * L'invité tourne dans un PROCESSUS À PART (Node, modèle de permissions) :
 * aucun accès à `tentacle.db`, aux secrets ni à la clé Jellyfin. Il ne parle
 * à l'hôte que par une API FERMÉE (`HostApi`), et ne sert HTTP qu'à l'hôte, qui
 * le relaie sous `/api/plugins/<id>/*` après `requireAuth`. Le runtime d'avant
 * (module importé dans le processus, `pluginBackendLoader.ts`) reste pour les
 * extensions qui ne déclarent pas `runtime.kind = "isolated"`.
 *
 * MIROIR : recopié octet pour octet dans `apps/backend/src/plugins/runtime/`
 * (test miroir), comme `serverCapabilities.ts`. Aucun import : il compile seul.
 * Les noms traversent la frontière d'un processus : ils ne se renomment jamais.
 */

/** `plugin.json` → `runtime`. */
export interface PluginRuntimeManifest {
  kind: "isolated";
  /** Le module, relatif au dossier de l'extension (`server/index.mjs`). */
  entry: string;
  /** Les outils qu'il DEMANDE ; l'administrateur les autorise un par un (liste blanche). */
  tools?: ToolName[];
  /** Les variables d'environnement qu'il lit (`LIDARR_URL`…) : seules celles-ci lui sont passées. */
  env?: string[];
  /** Les routes relayées SANS session (webhooks) : l'invité les authentifie lui-même (secret). */
  publicRoutes?: string[];
  /** Les familles de l'API d'hôte qu'il emploie (`HostApiFamily`). */
  hostApi?: HostApiFamily[];
}

/** Liste FERMÉE des outils qu'un hôte sait fournir. */
export type ToolName = "yt-dlp";

export type HostApiFamily = "jellyfin.music" | "users" | "events" | "tools";

/* ── Démarrage de l'invité ───────────────────────────────────────────── */

/** Variables posées par l'hôte au lancement (en plus des `env` déclarées et autorisées). */
export const GUEST_ENV = {
  pluginId: "TENTACLE_PLUGIN_ID",
  /** Dossier inscriptible PROPRE à l'extension : sa base SQLite (`plugin.db`), son cache. */
  dataDir: "TENTACLE_PLUGIN_DATA_DIR",
  /** Socket Unix (named pipe sous Windows) où l'invité DOIT écouter en HTTP. */
  socket: "TENTACLE_PLUGIN_SOCKET",
  /** Langue du serveur (« fr », « en »). */
  locale: "TENTACLE_LOCALE",
} as const;

/* ── Relais HTTP hôte → invité ───────────────────────────────────────── */

/**
 * En-têtes posés par l'hôte sur chaque requête relayée. `Authorization`, les
 * cookies et tout `x-tentacle-*` venu du client sont RETIRÉS avant. Une route
 * de `publicRoutes` arrive sans `x-tentacle-user-*`.
 */
export const RELAY_HEADERS = {
  userId: "x-tentacle-user-id",
  userName: "x-tentacle-user-name",
  isAdmin: "x-tentacle-is-admin",
  /** « personal » | « profile » | « device » : une session de profil ou d'appareil regarde, elle n'administre pas. */
  session: "x-tentacle-session",
  locale: "x-tentacle-locale",
  requestId: "x-tentacle-request-id",
} as const;

/* ── Messages IPC (process.send) ─────────────────────────────────────── */

export type GuestToHost =
  | { t: "ready"; version: string }
  | { t: "call"; id: number; method: HostMethod; params: unknown }
  | { t: "log"; level: "info" | "warn" | "error"; message: string };

export type HostToGuest =
  | { t: "result"; id: number; ok: true; value: unknown }
  | { t: "result"; id: number; ok: false; error: HostCallError }
  | { t: "event"; event: HostEvent }
  | { t: "shutdown"; reason: "disabled" | "restart" | "stop" };

export interface HostCallError {
  code: "forbidden" | "invalid" | "unavailable" | "notFound" | "timeout" | "failed";
  message: string;
}

/** Ce que l'hôte pousse à l'invité. */
export type HostEvent =
  /** Éléments audio vus par Jellyfin (mêmes données que `music:library`). */
  | { type: "jellyfin.audioItems"; added: AudioItemRef[]; updated: AudioItemRef[]; removed: string[] }
  | { type: "jellyfin.state"; state: "up" | "restarting" | "down" }
  | { type: "settings.changed" };

/* ── API d'hôte : liste FERMÉE méthode → paramètres → résultat ────────── */

export interface AudioItemRef {
  jellyfinId: string;
  recording: string | null;
  release: string | null;
  path: string | null;
}

export interface PlaylistUsage {
  playlistId: string;
  ownerUserId: string;
  entryId: string;
  position: number;
}

export interface HostApi {
  /** La bibliothèque musique DÉDIÉE (CollectionType music) et ses dossiers, tels que Jellyfin les voit. */
  "jellyfin.musicLibrary": { params: Record<string, never>; result: { libraryId: string; name: string; paths: string[] } | null };
  /** Éléments audio par MBID d'enregistrement (clé d'administration, côté hôte). */
  "jellyfin.findByMbid": { params: { recordings: string[] }; result: AudioItemRef[] };
  "jellyfin.setFavorite": { params: { userId: string; itemId: string; favorite: boolean }; result: { ok: true } };
  /** Insère à `position` (0 = tête ; au-delà de la fin = à la fin). */
  "jellyfin.playlistInsert": { params: { userId: string; playlistId: string; itemIds: string[]; position: number }; result: { ok: true } };
  "jellyfin.playlistEntries": { params: { userId: string; playlistId: string }; result: { entryId: string; itemId: string; position: number }[] };
  /** Qui a un élément en favori, et où il est dans quelles playlists — pour la re-liaison après remplacement. */
  "jellyfin.usageOf": { params: { itemIds: string[] }; result: { itemId: string; favoriteUserIds: string[]; playlists: PlaylistUsage[] }[] };
  /** Prévient Jellyfin qu'un chemin de SA bibliothèque musique a changé (scan ciblé). */
  "jellyfin.notifyPath": { params: { path: string; change: "created" | "modified" | "deleted" }; result: { ok: true } };
  /** Les droits du compte face à CETTE extension (Jellyfin + réglages du cœur). */
  "users.rights": { params: { userId: string }; result: { exists: boolean; isAdmin: boolean; canUse: boolean; canRequest: boolean } };
  /** Émet un événement musique (types : PLUGIN_EMITTABLE_MUSIC_EVENTS) aux comptes nommés. */
  "events.emit": { params: { userIds: string[]; event: Record<string, unknown> }; result: { delivered: number } };
  /** Version et chemin d'un outil AUTORISÉ (pour l'afficher ; jamais pour le lancer soi-même). */
  "tools.info": { params: { tool: ToolName }; result: { version: string | null; allowed: boolean } };
  /** Lancement ponctuel, arguments validés par la politique de l'outil (Zod, côté hôte). */
  "tools.exec": { params: { tool: ToolName; args: string[]; timeoutMs: number }; result: { code: number; stdout: string; stderr: string } };
  /**
   * Ouvrier PERSISTANT : l'interpréteur de l'outil charge `script` (relatif au
   * dossier de l'extension, jamais ailleurs) ; stdin/stdout reliés à une socket
   * que l'invité ouvre (`socketPath`), lignes JSON. L'hôte le relance s'il meurt.
   */
  "tools.spawnWorker": { params: { tool: ToolName; script: string; name: string }; result: { workerId: string; socketPath: string } };
  "tools.stopWorker": { params: { workerId: string }; result: { ok: true } };
}

export type HostMethod = keyof HostApi;

export const HOST_METHODS: readonly HostMethod[] = [
  "jellyfin.musicLibrary",
  "jellyfin.findByMbid",
  "jellyfin.setFavorite",
  "jellyfin.playlistInsert",
  "jellyfin.playlistEntries",
  "jellyfin.usageOf",
  "jellyfin.notifyPath",
  "users.rights",
  "events.emit",
  "tools.info",
  "tools.exec",
  "tools.spawnWorker",
  "tools.stopWorker",
];

/** La famille d'une méthode : appeler hors des familles déclarées → `forbidden`. */
export function hostMethodFamily(method: HostMethod): HostApiFamily {
  if (method.startsWith("jellyfin.")) return "jellyfin.music";
  if (method.startsWith("users.")) return "users";
  if (method.startsWith("events.")) return "events";
  return "tools";
}
