/**
 * Ce que la page « Services » lit sur le serveur Tentacle : les formes, les
 * clés de cache, et la mise en forme des réponses.
 *
 * Chaque réponse passe par un `read*` : l'application de bureau embarque cette
 * page et parle à des serveurs de toutes versions — un champ qu'un serveur
 * plus ancien ne connaît pas doit valoir « inconnu », pas faire tomber la
 * page. Sans `fetch` ici : ce module se teste sans monter l'application.
 */

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

export interface DatabaseFields {
  host: string;
  port: number;
  database: string;
  user: string;
}

export interface DatabaseService {
  status: ServiceStatus;
  version: string;
  /** Qui décide de la connexion au redémarrage ; `null` : inconnu ou aucune base. */
  source: "env" | "file" | null;
  pendingRestart: boolean;
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
}

export interface DirectStreamingTest {
  public: UrlProbe | null;
  private: UrlProbe | null;
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
  /** Partagée avec `AdminKeyBanner`, et son lecteur avec : un enregistrement réussi y efface l'alerte. */
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

export function readServices(raw: unknown): ServicesStatus {
  const jf = asRecord(asRecord(raw).jellyfin);
  const db = asRecord(asRecord(raw).database);
  const fields = asRecord(db.fields);
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
    database: {
      status: status(db.status),
      version: text(db.version),
      // `fromEnv` seul ne vaut rien : les serveurs d'avant `source` le disaient
      // vrai sur toute image Docker. Sans `source`, on ne sait pas.
      source: db.source === "env" || db.source === "file" ? db.source : null,
      pendingRestart: db.pendingRestart === true,
      fields: text(fields.host) ? {
        host: text(fields.host),
        port: count(fields.port) || 3306,
        database: text(fields.database),
        user: text(fields.user),
      } : null,
    },
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
  };
}

export function readDirectStreamingTest(raw: unknown): DirectStreamingTest {
  const r = asRecord(raw);
  return { public: readProbe(r.public), private: readProbe(r.private) };
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
