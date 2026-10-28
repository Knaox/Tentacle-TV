/**
 * Les requêtes DÉLÉGUÉES à l'appareil — une extension DÉCRIT une requête HTTP,
 * l'appareil qui l'a sollicitée (le bureau) l'exécute depuis SA connexion,
 * l'extension analyse la réponse. Ainsi cent comptes qui cherchent de la
 * musique ne font pas bloquer l'adresse du serveur : chacun parle depuis la
 * sienne. Le cœur ne nomme AUCUNE source : il applique ce que le manifeste de
 * l'extension déclare (`runtime.clientFetch`), et rien d'autre.
 *
 * Le cœur ne devient pas un proxy ouvert : https seul, hôtes DÉCLARÉS (noms
 * exacts), ni identifiants ni port, en-têtes de connexion et d'authentification
 * interdits, corps bornés, délai borné ; l'hôte ET l'appareil valident.
 *
 * MIROIR, octet pour octet (aucun import : il compile seul) — source canonique
 * ici, recopié dans `apps/backend/src/plugins/runtime/`,
 * `apps/desktop-electron/src/main/clientFetch/` et Sillon `types/tentacle/`.
 * Les noms traversent le réseau : ils ne se renomment jamais.
 */

/** `plugin.json` → `runtime.clientFetch`, validé. */
export interface ClientFetchManifest {
  /** Hôtes que l'appareil joint pour l'extension (noms exacts). */
  hosts: string[];
  /** Hôtes dont l'appareil lit un flux EN DIRECT (`PlaybackSource.direct`) ; un joker en tête permis. */
  mediaHosts: string[];
}

/** Une requête que l'extension décrit (famille d'API d'hôte `client`, `client.fetch`). */
export interface ClientFetchRequest {
  method: "GET" | "POST";
  /** https, hôte dans `hosts`, ni identifiants ni port. */
  url: string;
  headers?: Record<string, string>;
  /** POST seulement. */
  body?: string;
  /** Défaut 5 000, au plus 8 000. */
  timeoutMs?: number;
  /** Corps de réponse lu au plus (octets) ; défaut 1 Mo, au plus 2 Mo. */
  maxBytes?: number;
  /**
   * Un GESTE (`play` : clic, recherche validée, suivant) ou le FOND (`prefetch`) : le budget par adresse IP de
   * l'hôte sert les gestes d'abord. Absent (une extension d'avant) : un geste. L'appareil l'ignore.
   */
  kind?: "play" | "prefetch";
}

export interface ClientFetchResponse {
  status: number;
  /** L'adresse FINALE, après les redirections (chacune revalidée). */
  url: string;
  /** `content-type` seulement. */
  headers: Record<string, string>;
  body: string;
}

/** Pourquoi l'appareil n'a pas rendu de réponse (liste FERMÉE). */
export type ClientFetchRefusal =
  /** Aucun appareil joignable derrière cette poignée (socket fermée, poignée inconnue). */
  | "offline"
  /** Refusée par l'hôte ou l'appareil (hôte non déclaré, en-tête interdit, appareil qui ne sait pas). */
  | "refused"
  | "timeout"
  /** Plafond de l'appareil atteint (en parallèle, par minute, par heure). */
  | "budget"
  | "network"
  | "tooLarge";

export type ClientFetchOutcome = { ok: true; response: ClientFetchResponse } | { ok: false; reason: ClientFetchRefusal };

/* ── Le chemin : hôte → socket de l'appareil → réponse ───────────────── */

/** L'en-tête par lequel un appareil s'ANNONCE capable (le bureau seul) ; le relais le retire. */
export const CLIENT_FETCH_ANNOUNCE_HEADER = "x-tentacle-client-fetch";
/** Le message poussé sur la socket de l'appareil visé. */
export const CLIENT_FETCH_MESSAGE = "plugin:clientFetch";
/** La réponse de l'appareil : `POST <route>/<id>` avec `ClientFetchOutcome`. */
export const CLIENT_FETCH_REPLY_ROUTE = "/api/client-fetch";

export interface ClientFetchJob {
  type: typeof CLIENT_FETCH_MESSAGE;
  /** Identifiant d'une seule requête, à rappeler dans la réponse. */
  id: string;
  pluginId: string;
  request: ClientFetchRequest;
}

/* ── Les bornes ──────────────────────────────────────────────────────── */

export const CLIENT_FETCH_LIMITS = {
  maxHosts: 16,
  maxHeaders: 20,
  maxHeaderBytes: 8 * 1024,
  maxRequestBody: 64 * 1024,
  defaultTimeoutMs: 5_000,
  maxTimeoutMs: 8_000,
  defaultMaxBytes: 1024 * 1024,
  maxResponseBytes: 2 * 1024 * 1024,
  maxRedirects: 3,
  /** Plafond GÉNÉRIQUE de l'appareil, par extension, quoi qu'elle croie. */
  maxParallel: 4,
  perMinute: 30,
  perHour: 300,
} as const;

/** Jamais posés par l'extension : connexion, authentification, empreinte du navigateur. */
const FORBIDDEN_HEADER = /^(cookie|cookie2|authorization|proxy-.*|host|connection|keep-alive|content-length|transfer-encoding|te|trailer|upgrade|expect|sec-.*|x-tentacle-.*|x-emby-.*|x-mediabrowser-.*|x-forwarded-.*|forwarded|x-real-ip|via)$/i;
const HEADER_NAME = /^[A-Za-z0-9!#$%&'*+.^_`|~-]{1,64}$/;
const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;

/** Un nom d'hôte PUBLIC et déclarable : au moins deux labels, ni IP, ni `localhost`, ni domaine local. */
export function isDeclarableHost(host: string): boolean {
  if (host.length > 253 || host !== host.toLowerCase()) return false;
  const labels = host.split(".");
  if (labels.length < 2 || !labels.every((l) => LABEL.test(l))) return false;
  if (/^\d+$/.test(labels.at(-1) ?? "")) return false;
  return !/(^|\.)(localhost|local|internal|lan|home|arpa|test|invalid)$/.test(host);
}

function hostList(value: unknown, wildcard: boolean): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > CLIENT_FETCH_LIMITS.maxHosts) return null;
  const out: string[] = [];
  for (const v of value) {
    if (typeof v !== "string") return null;
    const bare = wildcard && v.startsWith("*.") ? v.slice(2) : v;
    if (!isDeclarableHost(bare)) return null;
    out.push(v);
  }
  return [...new Set(out)];
}

/** `runtime.clientFetch` validé ; `null` s'il est absent ou mal formé (aucun hôte, ou un hôte refusé). */
export function readClientFetchManifest(raw: unknown): ClientFetchManifest | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const hosts = hostList(r.hosts, false);
  const mediaHosts = hostList(r.mediaHosts, true);
  if (!hosts || !mediaHosts || hosts.length === 0) return null;
  return { hosts, mediaHosts };
}

/** `host` est-il dans `patterns` ? Égalité exacte ; `*.d` vaut tout sous-domaine de `d` (jamais `d` lui-même). */
export function hostAllowed(host: string, patterns: readonly string[]): boolean {
  const h = host.toLowerCase();
  return patterns.some((p) => (p.startsWith("*.") ? h.endsWith(p.slice(1)) && h.length > p.length - 1 : h === p));
}

/** Une adresse https sans identifiants ni port, d'un hôte de `patterns` ; `null` sinon. */
export function allowedUrl(raw: string, patterns: readonly string[]): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "" || url.port !== "") return null;
  return hostAllowed(url.hostname, patterns) ? url : null;
}

/** La requête est-elle permise par ce manifeste ? `null` : oui ; sinon le motif (journal, jamais affiché). */
export function checkClientFetchRequest(request: unknown, manifest: ClientFetchManifest): string | null {
  if (!request || typeof request !== "object") return "requête absente";
  const r = request as Partial<ClientFetchRequest>;
  if (r.method !== "GET" && r.method !== "POST") return "méthode refusée";
  if (typeof r.url !== "string" || r.url.length > 4096 || !allowedUrl(r.url, manifest.hosts)) return "adresse hors des hôtes déclarés";
  if (r.body !== undefined && (typeof r.body !== "string" || r.method !== "POST" || utf8Bytes(r.body) > CLIENT_FETCH_LIMITS.maxRequestBody)) return "corps refusé";
  if (r.timeoutMs !== undefined && !(Number.isInteger(r.timeoutMs) && r.timeoutMs > 0 && r.timeoutMs <= CLIENT_FETCH_LIMITS.maxTimeoutMs)) return "délai refusé";
  if (r.maxBytes !== undefined && !(Number.isInteger(r.maxBytes) && r.maxBytes > 0 && r.maxBytes <= CLIENT_FETCH_LIMITS.maxResponseBytes)) return "taille refusée";
  if (r.kind !== undefined && r.kind !== "play" && r.kind !== "prefetch") return "nature refusée";
  if (r.headers !== undefined) {
    if (!r.headers || typeof r.headers !== "object" || Array.isArray(r.headers)) return "en-têtes refusés";
    const entries = Object.entries(r.headers);
    if (entries.length > CLIENT_FETCH_LIMITS.maxHeaders) return "trop d'en-têtes";
    let bytes = 0;
    for (const [name, value] of entries) {
      if (!HEADER_NAME.test(name) || FORBIDDEN_HEADER.test(name)) return `en-tête interdit : ${name.slice(0, 64)}`;
      if (typeof value !== "string" || /[\r\n\0]/.test(value)) return "valeur d'en-tête refusée";
      bytes += name.length + utf8Bytes(value);
    }
    if (bytes > CLIENT_FETCH_LIMITS.maxHeaderBytes) return "en-têtes trop longs";
  }
  return null;
}

function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).length;
}
