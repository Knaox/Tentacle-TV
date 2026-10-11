/**
 * Le protocole entre un HÔTE qui supervise le serveur (l'app Windows
 * « Tentacle Server », `apps/server-windows`) et le serveur qu'il lance
 * (`apps/backend/dist/index.js`, le même code que l'image Docker).
 *
 * Transport : le canal IPC de Node (`spawn(…, { stdio: [..., "ipc"],
 * serialization: "json" })`). Chaque message est un objet JSON dont `type`
 * commence par `tentacle:`. Un message inconnu est IGNORÉ des deux côtés :
 * c'est ce qui laisse l'hôte et le serveur évoluer chacun à son pas. Sous
 * Docker il n'y a pas de canal (`process.send` absent) : tout ce protocole est
 * muet, et le serveur se comporte exactement comme avant.
 *
 * Source canonique ici (shared) ; recopiée octet pour octet dans
 * `apps/backend/src/serverHost/hostProtocol.ts` (`hostProtocolMirror.test.ts`).
 * Les noms de types et de champs traversent le canal : ils ne se renomment
 * jamais. Doc : `protocole-ipc-hote-serveur.md` (bibliothèque du projet).
 */

/** Version du protocole. Un ajout additif ne la change pas ; une rupture, si. */
export const HOST_PROTOCOL_VERSION = 1;

/**
 * Codes de sortie du serveur. Docker relance sur tout code
 * (`restart: unless-stopped`) : l'image ne change pas de comportement.
 * - `STOPPED` : arrêté à la demande, ne pas relancer ;
 * - `RESTART` : « relance-moi » (extension installée, nouvelle migration) —
 *   75 vaut EX_TEMPFAIL de sysexits ;
 * - `FAILED` : échec. Avant `tentacle:ready`, `tentacle:startup-failed` dit
 *   pourquoi ; après, c'est un plantage (relance avec délai croissant).
 */
export const SERVER_EXIT_CODES = { STOPPED: 0, FAILED: 1, RESTART: 75 } as const;

/** Bornes de l'arrêt propre. L'hôte attend `hostGraceMs`, puis termine l'objet Job. */
export const SHUTDOWN_TIMINGS = {
  /** Tâches de fond : reco, recherche, temps de visionnage (son bail rendu). */
  backgroundStopMs: 2000,
  /** Fermeture HTTP : un flux vidéo relayé ne doit pas retenir l'arrêt. */
  httpCloseMs: 3000,
  /** Point de contrôle du WAL puis déconnexion de Prisma. */
  databaseCloseMs: 3000,
  /** Ce que l'hôte accorde au serveur entre `tentacle:shutdown` et la mise à mort. */
  hostGraceMs: 10_000,
} as const;

/** Pourquoi l'hôte arrête le serveur (journal seulement : tous mènent au même arrêt). */
export const SHUTDOWN_REASONS = ["quit", "session-end", "update", "restart", "port-change"] as const;
export type ShutdownReason = (typeof SHUTDOWN_REASONS)[number];

/** Pourquoi le serveur n'a pas pu démarrer (avant `tentacle:ready`). Liste FERMÉE. */
export const STARTUP_FAILURES = ["port_in_use", "already_running", "data_dir_unwritable", "unexpected"] as const;
export type StartupFailure = (typeof STARTUP_FAILURES)[number];

/** Les questions que l'hôte peut poser au serveur (`tentacle:request`). */
export const SERVER_METHODS = ["status"] as const;
export type ServerMethod = (typeof SERVER_METHODS)[number];

/** Réponse de `status` : de quoi choisir un « moment calme » (mise à jour du Store). */
export interface ServerStatus {
  bootId: string;
  /** `running`, `setup_jellyfin`, `setup_admin` ou `database_unavailable` (état du serveur). */
  appState: string;
  /** Une lecture en cours sur Jellyfin ; `null` si on ne sait pas (Jellyfin muet, pas relié). */
  playbackActive: boolean | null;
  /** Un redémarrage est déjà décidé (extension) : l'hôte attend la sortie 75. */
  restartPending: boolean;
}

// ── Hôte → serveur ──────────────────────────────────────────────────────────

/** Juste après le lancement : qui supervise, et ce qu'il sait faire pour le serveur. */
export interface HostHelloMessage {
  type: "tentacle:host-hello";
  protocol: number;
  /** Version de l'app hôte (pas celle du serveur embarqué). */
  hostVersion: string;
  /** Les méthodes que l'hôte sert au serveur (`tentacle:request` dans l'autre sens). */
  methods: string[];
}

/** Arrêt propre demandé ; le serveur sort avec `STOPPED`. */
export interface ShutdownMessage {
  type: "tentacle:shutdown";
  reason: ShutdownReason;
}

// ── Serveur → hôte ──────────────────────────────────────────────────────────

/** Le serveur écoute. */
export interface ReadyMessage {
  type: "tentacle:ready";
  protocol: number;
  bootId: string;
  /** Version du serveur (`versions.json` → `server`). */
  version: string;
  port: number;
  appState: string;
}

/** Démarrage impossible ; suivi de la sortie `FAILED`. */
export interface StartupFailedMessage {
  type: "tentacle:startup-failed";
  reason: StartupFailure;
  /** Une ligne pour le journal, sans secret. */
  detail?: string;
}

/** Un redémarrage est décidé ; suivi de la sortie `RESTART` après l'arrêt propre. */
export interface RestartingMessage {
  type: "tentacle:restarting";
  /** Une ligne pour le journal (« Plugin « Vigie » installé »). */
  detail: string;
}

// ── Les deux sens : question et réponse ─────────────────────────────────────

export interface RequestMessage {
  type: "tentacle:request";
  /** Unique pour l'émetteur ; la réponse le reprend. */
  id: string;
  method: string;
  params?: unknown;
}

export type ResponseMessage =
  | { type: "tentacle:response"; id: string; ok: true; result: unknown }
  | { type: "tentacle:response"; id: string; ok: false; error: HostProtocolError };

/** Liste FERMÉE : `unknown_method` dit à l'appelant que l'autre côté est plus ancien. */
export type HostProtocolError = "unknown_method" | "invalid_params" | "failed" | "timeout";

export type HostToServerMessage = HostHelloMessage | ShutdownMessage | RequestMessage | ResponseMessage;
export type ServerToHostMessage = ReadyMessage | StartupFailedMessage | RestartingMessage | RequestMessage | ResponseMessage;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Lecture tolérante d'un message reçu par le SERVEUR ; `null` = à ignorer. */
export function parseHostMessage(raw: unknown): HostToServerMessage | null {
  if (!isRecord(raw) || typeof raw.type !== "string") return null;
  switch (raw.type) {
    case "tentacle:host-hello":
      if (typeof raw.protocol !== "number") return null;
      return {
        type: raw.type,
        protocol: raw.protocol,
        hostVersion: typeof raw.hostVersion === "string" ? raw.hostVersion : "",
        methods: Array.isArray(raw.methods) ? raw.methods.filter((m): m is string => typeof m === "string") : [],
      };
    case "tentacle:shutdown": {
      const reason = SHUTDOWN_REASONS.find((r) => r === raw.reason) ?? "quit";
      return { type: raw.type, reason };
    }
    case "tentacle:request":
      return parseRequest(raw);
    case "tentacle:response":
      return parseResponse(raw);
    default:
      return null;
  }
}

/** Lecture tolérante d'un message reçu par l'HÔTE ; `null` = à ignorer. */
export function parseServerMessage(raw: unknown): ServerToHostMessage | null {
  if (!isRecord(raw) || typeof raw.type !== "string") return null;
  switch (raw.type) {
    case "tentacle:ready":
      if (typeof raw.port !== "number" || typeof raw.bootId !== "string") return null;
      return {
        type: raw.type,
        protocol: typeof raw.protocol === "number" ? raw.protocol : 0,
        bootId: raw.bootId,
        version: typeof raw.version === "string" ? raw.version : "",
        port: raw.port,
        appState: typeof raw.appState === "string" ? raw.appState : "",
      };
    case "tentacle:startup-failed": {
      const reason = STARTUP_FAILURES.find((r) => r === raw.reason) ?? "unexpected";
      return typeof raw.detail === "string" ? { type: raw.type, reason, detail: raw.detail } : { type: raw.type, reason };
    }
    case "tentacle:restarting":
      return { type: raw.type, detail: typeof raw.detail === "string" ? raw.detail : "" };
    case "tentacle:request":
      return parseRequest(raw);
    case "tentacle:response":
      return parseResponse(raw);
    default:
      return null;
  }
}

function parseRequest(raw: Record<string, unknown>): RequestMessage | null {
  if (typeof raw.id !== "string" || !raw.id || typeof raw.method !== "string") return null;
  return raw.params === undefined
    ? { type: "tentacle:request", id: raw.id, method: raw.method }
    : { type: "tentacle:request", id: raw.id, method: raw.method, params: raw.params };
}

const ERRORS: readonly HostProtocolError[] = ["unknown_method", "invalid_params", "failed", "timeout"];

function parseResponse(raw: Record<string, unknown>): ResponseMessage | null {
  if (typeof raw.id !== "string" || !raw.id || typeof raw.ok !== "boolean") return null;
  if (raw.ok) return { type: "tentacle:response", id: raw.id, ok: true, result: raw.result };
  const error = ERRORS.find((e) => e === raw.error) ?? "failed";
  return { type: "tentacle:response", id: raw.id, ok: false, error };
}
