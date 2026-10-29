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
 * (test miroir), comme `serverCapabilities.ts`. Un seul import, de TYPES, de son
 * voisin `pluginClientFetch.ts`, recopié avec lui : les deux compilent seuls.
 * Les noms traversent la frontière d'un processus : ils ne se renomment jamais.
 */

import type { ClientFetchManifest, ClientFetchOutcome, ClientFetchRequest } from "./pluginClientFetch";

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
  /** Hôtes que l'APPAREIL appelant joint pour elle, et lit en direct (`pluginClientFetch.ts`). */
  clientFetch?: ClientFetchManifest;
}



/** Liste FERMÉE des outils qu'un hôte sait fournir. */
export type ToolName = "yt-dlp";

export type HostApiFamily = "jellyfin.music" | "users" | "events" | "tools" | "client";

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
  /** Poignée OPAQUE de l'appareil appelant pour `client.fetch` (stable par appareil et extension), s'il s'est annoncé. */
  client: "x-tentacle-client",
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

/** Un titre à reconnaître dans la bibliothèque (`jellyfin.matchTracks`) ; `ref` revient tel quel. */
export interface HostMatchTrack {
  ref: string;
  title: string;
  artists: { name: string; mbid: string | null }[];
  albumTitle: string | null;
  durationMs: number | null;
  recording: string | null;
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
  /**
   * Ce que la bibliothèque de CE compte a parmi ces titres, par LA règle de `POST /api/music/match` (MBID, sinon titre
   * + artiste + durée), lue dans l'index local : aucune requête Jellyfin par titre ; 200 au plus. Hôte d'avant :
   * méthode inconnue (`invalid`) — l'extension garde `findByMbid`.
   */
  "jellyfin.matchTracks": { params: { userId: string; tracks: HostMatchTrack[] }; result: { ref: string; item: AudioItemRef }[] };
  "jellyfin.setFavorite": { params: { userId: string; itemId: string; favorite: boolean }; result: { ok: true } };
  /**
   * Insère à `position` (0 = tête ; au-delà de la fin = à la fin). `sourceIndex` (serveur 1.40.0, un titre d'une playlist
   * IMPORTÉE : son rang dans la source, `ImportedTrack.index`) : l'hôte le pose juste après celui qui le précède dans la
   * source, `position` n'étant qu'un repli ; il rend la place prise. Hôte d'avant : paramètre inconnu (`invalid`).
   */
  "jellyfin.playlistInsert": { params: { userId: string; playlistId: string; itemIds: string[]; position: number; sourceIndex?: number }; result: { ok: true; position?: number } };
  /**
   * L'utilisateur a RETIRÉ de cette playlist importée le titre de rang `sourceIndex` de la source (l'entrée que
   * l'extension tenait pour lui) : il n'y reviendra jamais, même arrivé dans la bibliothèque. `marked: false` : rien à
   * marquer (playlist sans relevé, rang inconnu). Serveur 1.40.0 ; un hôte d'avant : méthode inconnue (`invalid`).
   */
  "jellyfin.playlistSourceRemoved": { params: { userId: string; playlistId: string; sourceIndex: number }; result: { ok: true; marked: boolean } };
  "jellyfin.playlistEntries": { params: { userId: string; playlistId: string }; result: { entryId: string; itemId: string; position: number }[] };
  /**
   * Ce compte peut-il MODIFIER cette playlist (Jellyfin : `CanDelete`, vu par lui) ? `false` aussi pour une playlist
   * qu'il ne voit pas. Serveur 1.40.0 (import de playlists) ; un hôte d'avant : méthode inconnue (`invalid`).
   */
  "jellyfin.playlistEditable": { params: { userId: string; playlistId: string }; result: { editable: boolean } };
  /** Qui a un élément en favori, et où il est dans quelles playlists — pour la re-liaison après remplacement. */
  "jellyfin.usageOf": { params: { itemIds: string[] }; result: { itemId: string; favoriteUserIds: string[]; playlists: PlaylistUsage[] }[] };
  /** Prévient Jellyfin qu'un chemin de SA bibliothèque musique a changé (scan ciblé). */
  "jellyfin.notifyPath": { params: { path: string; change: "created" | "modified" | "deleted" }; result: { ok: true } };
  /**
   * Rafraîchit TOUT DE SUITE (sans attendre `LibraryMonitorDelay`, 60 s par défaut)
   * le dossier connu de Jellyfin le plus proche qui contient `path` — album, sinon
   * artiste —, récursivement. Aucun dossier connu (artiste neuf) : la bibliothèque
   * musique non récursivement, puis le dossier apparu. Hors de la bibliothèque
   * musique : `invalid`. Venu après : une extension le teste (`forbidden`/`invalid`
   * d'un hôte d'avant) et garde `notifyPath` en repli.
   */
  "jellyfin.refreshPath": { params: { path: string }; result: { ok: true; scope: "folder" | "library"; itemId: string } };
  /**
   * Les droits du compte face à CETTE extension (Jellyfin + réglages du cœur). `familyGuest` : le compte est un
   * invité de la Famille (absent : hôte d'avant, on ne sait pas). `keepOffline` (capacité `offline.music`, absent
   * d'un hôte d'avant : à lire comme FAUX) : le compte peut garder hors ligne ce que l'extension lui sert — `canUse`,
   * `EnableContentDownloading` de Jellyfin, et jamais un invité. L'extension vérifie EN PLUS que la requête vient
   * d'une session personnelle (`x-tentacle-session`).
   */
  "users.rights": { params: { userId: string }; result: { exists: boolean; isAdmin: boolean; canUse: boolean; canRequest: boolean; familyGuest?: boolean; keepOffline?: boolean } };
  /**
   * Les comptes du serveur, pour qu'une extension règle des droits par compte : Jellyfin, désactivés exclus, SANS
   * les invités de la Famille (`withoutFamilyGuests`). Un hôte d'avant : méthode inconnue (`invalid`).
   */
  "users.list": { params: Record<string, never>; result: { userId: string; name: string; isAdmin: boolean }[] };
  /** Émet un événement musique (types : PLUGIN_EMITTABLE_MUSIC_EVENTS) aux comptes nommés. */
  "events.emit": { params: { userIds: string[]; event: Record<string, unknown> }; result: { delivered: number } };
  /** Version et chemin d'un outil AUTORISÉ (pour l'afficher ; jamais pour le lancer soi-même). */
  "tools.info": { params: { tool: ToolName }; result: { version: string | null; allowed: boolean } };
  /** Lancement ponctuel, arguments validés par la politique de l'outil (Zod, côté hôte). */
  "tools.exec": { params: { tool: ToolName; args: string[]; timeoutMs: number }; result: { code: number; stdout: string; stderr: string } };
  /**
   * Ouvrier PERSISTANT fourni par l'HÔTE (jamais un script de l'extension :
   * il tournerait hors du bac à sable) : l'interpréteur de l'outil charge la
   * bibliothèque depuis l'outil en service et parle le protocole FERMÉ
   * `WorkerRequest` / `WorkerMessage` en lignes JSON sur `socketPath`, que
   * l'invité ouvre. L'hôte le relance s'il meurt ; sorties sous le dossier de
   * données de l'extension seulement.
   */
  "tools.spawnWorker": { params: { tool: ToolName; name: string }; result: { workerId: string; socketPath: string } };
  "tools.stopWorker": { params: { workerId: string }; result: { ok: true } };
  /**
   * Le BUDGET YOUTUBE de l'hôte : une place pour `cost` requêtes (1 à 4) vers
   * youtube.com, music.youtube.com ou InnerTube — par l'ouvrier comme en HTTP
   * direct —, comptées dès l'accord. L'hôte tient UN registre pour lui et ses
   * extensions (les bandes-annonces sortent par la même adresse) : 150 par
   * heure et 20 par minute en tout ; une extension en `play` tant que l'heure
   * est sous 140, en `prefetch` sous 110, 100 par heure au plus ; cadence de
   * 250 ms (`waitMs` : attendre avant de lancer). Disjoncteur COMMUN ouvert :
   * `blocked`, sauf une lecture-sonde toutes les 5 min. Exige la famille
   * `tools` ET un outil demandé au manifeste. Hôte d'avant : `forbidden`
   * (méthode inconnue) — l'extension garde alors sa propre garde.
   */
  "tools.youtubeAdmit": {
    params: { kind: "play" | "prefetch"; cost: number };
    result: { granted: true; waitMs: number } | { granted: false; reason: "blocked" | "budget"; retryAfterMs: number };
  };
  /**
   * Le verdict d'une requête accordée : `antiBot` (vérification anti-robot,
   * limite de débit) ouvre le disjoncteur commun ; `ok`, partie (`startedAt`,
   * millisecondes de l'horloge de l'hôte comme de l'invité : `Date.now()`)
   * APRÈS sa dernière ouverture, le referme.
   */
  "tools.youtubeReport": { params: { outcome: "ok" | "antiBot"; startedAt: number }; result: { ok: true } };
  /**
   * Fait EXÉCUTER `request` par l'appareil de la poignée `client`, et seulement lui : sa réponse, ou
   * le motif d'un échec. Exige la famille `client` et `runtime.clientFetch`. Hôte d'avant : `forbidden`.
   */
  "client.fetch": { params: { client: string; request: ClientFetchRequest }; result: ClientFetchOutcome };
}

export type HostMethod = keyof HostApi;

export const HOST_METHODS: readonly HostMethod[] = [
  "jellyfin.musicLibrary",
  "jellyfin.findByMbid",
  "jellyfin.matchTracks",
  "jellyfin.setFavorite",
  "jellyfin.playlistInsert",
  "jellyfin.playlistSourceRemoved",
  "jellyfin.playlistEntries",
  "jellyfin.playlistEditable",
  "jellyfin.usageOf",
  "jellyfin.notifyPath",
  "jellyfin.refreshPath",
  "users.rights",
  "users.list",
  "events.emit",
  "tools.info",
  "tools.exec",
  "tools.spawnWorker",
  "tools.stopWorker",
  "tools.youtubeAdmit",
  "tools.youtubeReport",
  "client.fetch",
];

/** La famille d'une méthode : appeler hors des familles déclarées → `forbidden`. */
export function hostMethodFamily(method: HostMethod): HostApiFamily {
  if (method.startsWith("jellyfin.")) return "jellyfin.music";
  if (method.startsWith("users.")) return "users";
  if (method.startsWith("events.")) return "events";
  if (method.startsWith("client.")) return "client";
  return "tools";
}

/* ── Protocole de l'ouvrier persistant (lignes JSON, une requête par ligne) ── */

/**
 * Options PERMISES, liste FERMÉE validée par Zod côté hôte (une option de plus
 * se demande au coordinateur). Jamais `exec`, `config`, `plugin_dirs`, ni un
 * chemin de sortie hors du dossier de données.
 */
export interface WorkerOptions {
  /**
   * `extractor_args` de yt-dlp, par extracteur (ex. `{ youtube: { player_client: ["web_music"] } }`).
   * Chaque valeur : 100 caractères au plus, sauf `youtube.visitor_data` — UNE valeur, le visitorData
   * d'InnerTube (base64url, `%`, `=` ; 20 à 1 024 caractères), à passer avec `player_skip` `webpage` et
   * `configs` (plus de page watch). Secret de session : jamais journalisé, ni par l'hôte ni par l'ouvrier.
   */
  extractorArgs?: Record<string, Record<string, string[]>>;
  /** Sélecteur de format (« bestaudio[acodec=opus]/bestaudio »). */
  format?: string;
  socketTimeoutS?: number;
  retries?: number;
  /** Fragments téléchargés en parallèle (`concurrent_fragment_downloads`). */
  concurrentFragments?: number;
  /** Ne pas résoudre chaque entrée d'une recherche (`extract_flat`). */
  flat?: boolean;
  /** Nombre d'entrées d'une recherche ou d'une playlist. */
  limit?: number;
}

export type WorkerRequest =
  | { id: number; op: "version" }
  /** `target` : une URL https de YouTube / YouTube Music, ou une recherche `ytsearchN:<texte>`. */
  | { id: number; op: "extract"; target: string; options?: WorkerOptions }
  /** Écrit le format choisi, TEL QUEL (aucun post-traitement), sous `output`, relatif au dossier de données. */
  | { id: number; op: "download"; url: string; formatId: string; output: string; options?: WorkerOptions }
  | { id: number; op: "cancel"; target: number };

export interface WorkerFormat {
  formatId: string;
  ext: string;
  acodec: string | null;
  vcodec: string | null;
  /** kbit/s */
  abr: number | null;
  asr: number | null;
  filesize: number | null;
  protocol: string | null;
  /** URL directe du flux (expire) et en-têtes à rejouer pour la lire. */
  url: string | null;
  httpHeaders: Record<string, string>;
}

/** Ce que l'ouvrier rend d'une vidéo ou d'une entrée de recherche — champs choisis, jamais l'objet brut. */
export interface WorkerInfo {
  id: string;
  title: string | null;
  /** Titre de piste et artistes quand la source les donne (YouTube Music). */
  track: string | null;
  artists: string[];
  album: string | null;
  channel: string | null;
  channelId: string | null;
  uploader: string | null;
  durationS: number | null;
  isLive: boolean;
  webpageUrl: string | null;
  categories: string[];
  formats: WorkerFormat[];
  entries: WorkerInfo[];
}

export type WorkerErrorCode = "antiBot" | "unavailable" | "invalid" | "failed" | "timeout" | "cancelled";

export type WorkerMessage =
  | { id: number; ok: true; result: { version: string } | WorkerInfo | { path: string; bytes: number } }
  | { id: number; ok: false; error: { code: WorkerErrorCode; message: string } }
  /** Avancement d'un `download` : le fichier se lit pendant qu'il s'écrit. */
  | { id: number; event: "progress"; bytes: number; total: number | null };
