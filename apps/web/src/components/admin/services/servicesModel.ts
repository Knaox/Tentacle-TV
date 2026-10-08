/**
 * Ce que la page « Services » lit sur le serveur Tentacle : les formes, les
 * clés de cache, et la mise en forme des réponses.
 *
 * Chaque réponse passe par un `read*` : l'application de bureau embarque cette
 * page et parle à des serveurs de toutes versions — un champ qu'un serveur
 * plus ancien ne connaît pas doit valoir « inconnu », pas faire tomber la
 * page. Sans `fetch` ici : ce module se teste sans monter l'application.
 */

import type { JellyfinCorsReport } from "@tentacle-tv/shared";
import { ADMIN_KEY_HEALTH_KEY } from "../../../lib/adminKeyHealth";

export type ServiceStatus = "connected" | "error" | "disconnected";
export type JellyfinFailure = "jellyfin-unreachable" | "jellyfin-invalid" | "jellyfin-rejected";

export interface JellyfinService {
  status: ServiceStatus;
  url: string;
  version: string;
  serverName: string;
  /** `null` : serveur d'avant la clé facultative — il faut la retaper pour tester. */
  apiKeyConfigured: boolean | null;
  error: JellyfinFailure | null;
  httpStatus: number | null;
}

/** La connexion MariaDB d'un serveur d'avant 1.25 — montrée, jamais modifiable d'ici. */
export interface DatabaseFields {
  host: string;
  port: number;
  database: string;
  user: string;
}

/** Où vit le fichier de la base : `network`, un partage réseau où SQLite peut se corrompre. */
export type DatabaseStorage = "local" | "network" | "unknown";

/**
 * La base du serveur. Depuis 1.25, un fichier SQLite que rien ne règle :
 * moteur, chemin, taille, état. Un serveur d'avant ne dit pas son moteur
 * (`engine: null`) : il est sur MariaDB, décrit par `fields`.
 */
export interface DatabaseService {
  status: ServiceStatus;
  version: string;
  /** `sqlite` aujourd'hui ; `null` : serveur d'avant 1.25, sur MariaDB. */
  engine: string | null;
  /** Le fichier de la base (SQLite) ; vide sur un serveur d'avant. */
  path: string;
  /** Le fichier et son journal, en octets ; `null` : inconnu. */
  sizeBytes: number | null;
  storage: DatabaseStorage;
  /** Pourquoi la base ne s'ouvre pas, tel que le serveur le dit ; `null` : rien à dire. */
  error: string | null;
  /** Serveur d'avant 1.25 : une autre connexion MariaDB attend le redémarrage. */
  pendingRestart: boolean;
  /** Serveur d'avant 1.25 : la connexion MariaDB en service. */
  fields: DatabaseFields | null;
}

export interface ServicesStatus {
  jellyfin: JellyfinService;
  database: DatabaseService;
}

export interface PublicUrlConfig {
  /** La valeur enregistrée en base — vide : repli sur l'environnement. */
  publicUrl: string;
  /** Celle qui sert vraiment, repli compris. */
  effectiveUrl: string;
  envFallback: string;
}

export interface DirectStreamingConfig {
  enabled: boolean;
  publicUrl: string;
  privateUrl: string;
}

export interface UrlProbe {
  ok: boolean;
  version: string | null;
  error: string | null;
  corsOk: boolean | null;
  /** Même origine que la page : aucun CORS n'est nécessaire (serveur 1.24.0 et après). */
  sameOrigin: boolean;
}

export interface DirectStreamingTest {
  public: UrlProbe | null;
  private: UrlProbe | null;
  /** Les CorsHosts de Jellyfin, mis à jour avant la sonde (serveur 1.24.0 et après), sinon `null`. */
  cors: JellyfinCorsReport | null;
}

export interface AudioCounters {
  jobs: number;
  windows: number;
  bytes: number;
  seconds: number;
  verdicts: number;
  silent: number;
  /** `null` : serveur d'avant ce compteur. */
  deferred: number | null;
}

export interface AudioAnalysisStatus {
  enabled: boolean;
  tool: string | null;
  counters: AudioCounters;
}

export const SERVICES_KEYS = {
  status: ["admin", "services", "status"],
  publicUrl: ["admin", "services", "public-url"],
  directStreaming: ["admin", "services", "direct-streaming"],
  audioAnalysis: ["admin", "services", "audio-analysis"],
  /** Partagée avec l'avertissement des clients (`useAdminKeyHealth`), et son lecteur avec : un enregistrement réussi y efface l'alerte. */
  jellyfinKey: ADMIN_KEY_HEALTH_KEY,
} as const;

/** Un refus du serveur, avec son code quand il en donne un. */
export class AdminApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
    readonly httpStatus: number | null,
    message: string,
  ) {
    super(message);
  }
}

type Json = Record<string, unknown>;

export const text = (value: unknown): string => (typeof value === "string" ? value : "");
const count = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : 0);
export const asRecord = (value: unknown): Json => (value && typeof value === "object" ? (value as Json) : {});
const status = (value: unknown): ServiceStatus =>
  value === "connected" || value === "error" ? value : "disconnected";

function readDatabase(db: Json): DatabaseService {
  const engine = text(db.engine) || null;
  const fields = asRecord(db.fields);
  const size = db.sizeBytes;
  return {
    status: status(db.status),
    version: text(db.version),
    engine,
    path: text(db.path),
    sizeBytes: typeof size === "number" && Number.isFinite(size) && size >= 0 ? size : null,
    storage: db.storage === "local" || db.storage === "network" ? db.storage : "unknown",
    error: text(db.error) || null,
    // Seulement sur MariaDB : un serveur SQLite garde ces champs pour l'admin d'avant 1.25.
    pendingRestart: engine === null && db.pendingRestart === true,
    fields: engine === null && text(fields.host) ? {
      host: text(fields.host),
      port: count(fields.port) || 3306,
      database: text(fields.database),
      user: text(fields.user),
    } : null,
  };
}

export function readServices(raw: unknown): ServicesStatus {
  const jf = asRecord(asRecord(raw).jellyfin);
  const failure = text(jf.error);
  return {
    jellyfin: {
      status: status(jf.status),
      url: text(jf.url),
      version: text(jf.version),
      serverName: text(jf.serverName),
      apiKeyConfigured: typeof jf.apiKeyConfigured === "boolean" ? jf.apiKeyConfigured : null,
      error: failure === "jellyfin-unreachable" || failure === "jellyfin-invalid" || failure === "jellyfin-rejected" ? failure : null,
      httpStatus: typeof jf.httpStatus === "number" ? jf.httpStatus : null,
    },
    database: readDatabase(asRecord(asRecord(raw).database)),
  };
}

export function readPublicUrl(raw: unknown): PublicUrlConfig {
  const r = asRecord(raw);
  const publicUrl = text(r.publicUrl);
  const envFallback = text(r.envFallback);
  return { publicUrl, envFallback, effectiveUrl: text(r.effectiveUrl) || publicUrl || envFallback };
}

export function readDirectStreaming(raw: unknown): DirectStreamingConfig {
  const r = asRecord(raw);
  return { enabled: r.enabled === true, publicUrl: text(r.publicUrl), privateUrl: text(r.privateUrl) };
}

function readProbe(raw: unknown): UrlProbe | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Json;
  return {
    ok: r.ok === true,
    version: text(r.version) || null,
    error: text(r.error) || null,
    corsOk: typeof r.corsOk === "boolean" ? r.corsOk : null,
    sameOrigin: r.sameOrigin === true,
  };
}

const CORS_STATUSES: readonly JellyfinCorsReport["status"][] = ["open", "ready", "updated", "unreachable", "not_configured"];

function readCors(raw: unknown): JellyfinCorsReport | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Json;
  const status = CORS_STATUSES.find((value) => value === r.status);
  if (!status) return null;
  const list = (value: unknown) => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);
  return { status, origins: list(r.origins), added: list(r.added) };
}

export function readDirectStreamingTest(raw: unknown): DirectStreamingTest {
  const r = asRecord(raw);
  return { public: readProbe(r.public), private: readProbe(r.private), cors: readCors(r.cors) };
}

export function readAudioAnalysis(raw: unknown): AudioAnalysisStatus {
  const r = asRecord(raw);
  const c = asRecord(r.counters);
  return {
    enabled: r.enabled === true,
    tool: text(r.tool) || null,
    counters: {
      jobs: count(c.jobs),
      windows: count(c.windows),
      bytes: count(c.bytes),
      seconds: count(c.seconds),
      verdicts: count(c.verdicts),
      silent: count(c.silent),
      deferred: typeof c.deferred === "number" ? c.deferred : null,
    },
  };
}
