import { lookup, type LookupAddress, type LookupAllOptions, type LookupOneOptions } from "dns";
import { isIP } from "net";
import { Agent, buildConnector, fetch, type Response } from "undici";
import { SetupError } from "../setupErrors";
import type { SetupErrorCode } from "../setupWizardContract";
import { classifyAddress } from "./addressGuard";

/**
 * Le seul chemin par lequel l'assistant parle à un Jellyfin dont l'adresse
 * vient de l'utilisateur. La garde est posée au niveau de la CONNEXION, pas
 * de l'URL : chaque socket ouvert — redirection, nom qui se résout autrement
 * entre deux appels (rebinding) — passe par elle. Une IP littérale ne passe
 * pas par la résolution : elle est vérifiée à part, au même endroit.
 *
 * Et rien ne remonte de ce que Jellyfin a répondu : un statut, un JSON borné
 * en taille, lu par l'appelant champ par champ — jamais renvoyé tel quel.
 */
export class BlockedAddressError extends Error {
  constructor(readonly loopback: boolean) {
    super(loopback ? "loopback address refused" : "address refused");
    this.name = "BlockedAddressError";
  }
}

let allowLoopback = true;
let agent: Agent | null = null;

/** Dans Docker, `localhost` est le conteneur de Tentacle : jamais un Jellyfin. */
export function configureJellyfinGuard(options: { allowLoopback: boolean }): void {
  allowLoopback = options.allowLoopback;
  void agent?.close();
  agent = null;
}

export function loopbackAllowed(): boolean {
  return allowLoopback;
}

function refusal(ip: string): BlockedAddressError | null {
  const verdict = classifyAddress(ip);
  if (verdict === "forbidden") return new BlockedAddressError(false);
  if (verdict === "loopback" && !allowLoopback) return new BlockedAddressError(true);
  return null;
}

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;

/** La résolution de nom, filtrée : une adresse refusée n'est jamais proposée à la connexion. */
function guardedLookup(hostname: string, options: LookupOneOptions | LookupAllOptions, callback: LookupCallback): void {
  lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, []);
    const allowed = addresses.filter((entry) => !refusal(entry.address));
    if (allowed.length === 0) return callback(refusal(addresses[0]?.address ?? "") ?? new BlockedAddressError(false), []);
    if ((options as LookupAllOptions).all) return callback(null, allowed);
    callback(null, allowed[0].address, allowed[0].family);
  });
}

function guardedAgent(): Agent {
  if (agent) return agent;
  const connector = buildConnector({ timeout: 5_000, lookup: guardedLookup });
  agent = new Agent({
    connect: (options, callback) => {
      const host = options.hostname.replace(/^\[(.*)\]$/, "$1");
      const refused = isIP(host) ? refusal(host) : null;
      if (refused) {
        callback(refused, null);
        return;
      }
      connector(options, callback);
    },
    connections: 8,
    keepAliveTimeout: 5_000,
    headersTimeout: 15_000,
    bodyTimeout: 30_000,
  });
  return agent;
}

const TLS_CODES = new Set([
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "CERT_HAS_EXPIRED",
  "CERT_NOT_YET_VALID",
  "ERR_TLS_CERT_ALTNAME_INVALID",
]);
const TIMEOUT_CODES = new Set(["UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT", "ETIMEDOUT"]);

/** L'échec réseau, dit en un code — la cause est cherchée dans la chaîne `cause` d'undici. */
export function networkErrorCode(err: unknown): SetupErrorCode {
  let current: unknown = err;
  for (let depth = 0; depth < 6 && current; depth++) {
    if (current instanceof BlockedAddressError) return current.loopback ? "jf_localhost_in_docker" : "jf_forbidden_address";
    const { name, code } = current as { name?: string; code?: string };
    if (name === "TimeoutError" || name === "AbortError" || (code && TIMEOUT_CODES.has(code))) return "jf_timeout";
    if (code && TLS_CODES.has(code)) return "jf_tls_invalid";
    current = (current as { cause?: unknown }).cause;
  }
  return "jf_unreachable";
}

export interface JellyfinRequest {
  method?: "GET" | "POST" | "DELETE";
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  /** L'en-tête `MediaBrowser …` (cf. `setupAuthorization`). */
  authorization?: string;
  timeoutMs?: number;
  /** Au-delà, la réponse est abandonnée : ce n'est pas ce qu'on attendait d'un Jellyfin. */
  maxBytes?: number;
}

export interface JellyfinReply {
  status: number;
  /** Le JSON d'une réponse 2xx, sinon `null`. */
  json: unknown;
  location: string | null;
}

async function readJsonCapped(res: Response, maxBytes: number): Promise<unknown> {
  if (!res.body) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of res.body) {
    size += chunk.byteLength;
    if (size > maxBytes) throw new SetupError("jf_not_jellyfin");
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf-8");
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new SetupError("jf_not_jellyfin");
  }
}

export async function jellyfinRequest(baseUrl: string, path: string, request: JellyfinRequest = {}): Promise<JellyfinReply> {
  const url = new URL(baseUrl.replace(/\/+$/, "") + path);
  for (const [key, value] of Object.entries(request.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  const headers: Record<string, string> = { Accept: "application/json" };
  if (request.authorization) headers.Authorization = request.authorization;
  if (request.body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(url, {
      method: request.method ?? "GET",
      headers,
      body: request.body === undefined ? undefined : JSON.stringify(request.body),
      redirect: "manual",
      signal: AbortSignal.timeout(request.timeoutMs ?? 8_000),
      dispatcher: guardedAgent(),
    });
  } catch (err) {
    throw new SetupError(networkErrorCode(err));
  }

  const location = res.headers.get("location");
  const isJson = (res.headers.get("content-type") ?? "").includes("json");
  if (res.status < 200 || res.status >= 300 || !isJson) {
    await res.body?.cancel().catch(() => undefined);
    return { status: res.status, json: null, location };
  }
  return { status: res.status, json: await readJsonCapped(res, request.maxBytes ?? 256 * 1024), location };
}
