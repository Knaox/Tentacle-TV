import { lookup } from "dns/promises";
import { request as httpRequest, type IncomingMessage } from "http";
import { request as httpsRequest } from "https";
import type { TLSSocket } from "tls";
import { CHALLENGE_PATH_PREFIX, type CheckTarget, type CheckTargetResult, type CheckVerdict } from "./checkProtocol";

/**
 * Une cible, sondée depuis l'extérieur — toujours à l'adresse du demandeur :
 * un nom de domaine n'y change que le nom présenté (SNI, Host), et seulement
 * s'il désigne bien cette adresse.
 *
 * GET seul, aucune redirection suivie, 5 secondes au plus, 4 Ko lus au plus.
 * Seul un verdict sort d'ici : ni corps, ni en-têtes, ni message d'erreur.
 */
export interface ProbeInput {
  sourceIp: string;
  family: 4 | 6;
  target: CheckTarget;
  challenge: { id: string; token: string };
  jellyfinId?: string;
}

export interface ProbeOptions {
  timeoutMs: number;
  maxBody?: number;
  /** Tests seulement : une autorité de certification de plus, et une résolution de nom simulée. */
  ca?: string;
  resolve?: (host: string, family: 4 | 6) => Promise<string[]>;
}

const result = (verdict: CheckVerdict, httpStatus: number | null = null, certificateExpires: string | null = null): CheckTargetResult => ({
  verdict,
  httpStatus,
  certificateExpires,
});

async function resolveHost(host: string, family: 4 | 6): Promise<string[]> {
  const found = await lookup(host, { all: true, family });
  return found.map((entry) => entry.address);
}

const sameIp = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Les codes d'erreur de Node, dits en verdicts. */
export function classifyError(code: string | undefined): CheckVerdict {
  switch (code) {
    case "ECONNREFUSED":
      return "refused";
    case "ETIMEDOUT":
    case "PROBE_TIMEOUT":
      return "timeout";
    case "DEPTH_ZERO_SELF_SIGNED_CERT":
    case "SELF_SIGNED_CERT_IN_CHAIN":
      return "tls_self_signed";
    case "CERT_HAS_EXPIRED":
      return "tls_expired";
    case "ERR_TLS_CERT_ALTNAME_INVALID":
      return "tls_name_mismatch";
    case "UNABLE_TO_VERIFY_LEAF_SIGNATURE":
    case "UNABLE_TO_GET_ISSUER_CERT":
    case "UNABLE_TO_GET_ISSUER_CERT_LOCALLY":
    case "CERT_UNTRUSTED":
      return "tls_untrusted";
    default:
      if (code && (code.startsWith("ERR_SSL") || code.startsWith("ERR_TLS") || code.startsWith("CERT_") || code === "EPROTO")) return "tls_error";
      return "unreachable";
  }
}

interface Fetched {
  status: number;
  location: string | null;
  body: string;
  certificateExpires: string | null;
}

function certificateExpiry(res: IncomingMessage): string | null {
  const socket = res.socket as TLSSocket;
  if (typeof socket.getPeerCertificate !== "function") return null;
  const validTo = socket.getPeerCertificate()?.valid_to;
  const date = validTo ? new Date(validTo) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
}

function fetchOnce(input: ProbeInput, path: string, options: ProbeOptions): Promise<Fetched | { error: string | undefined }> {
  const { target, sourceIp } = input;
  const https = target.scheme === "https";
  const maxBody = options.maxBody ?? 4096;
  const hostHeader = target.host ?? (input.family === 6 ? `[${sourceIp}]` : sourceIp);
  const send = https ? httpsRequest : httpRequest;
  // Comme un navigateur : pas de port dans Host quand c'est celui du schéma.
  const defaultPort = (https && target.port === 443) || (!https && target.port === 80);

  return new Promise((resolve) => {
    let settled = false;
    const done = (value: Fetched | { error: string | undefined }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const req = send({
      host: sourceIp,
      family: input.family,
      port: target.port,
      path,
      method: "GET",
      agent: false,
      headers: { host: defaultPort ? hostHeader : `${hostHeader}:${target.port}`, "user-agent": "Tentacle-PortCheck/1", accept: "*/*" },
      ...(https ? { servername: target.host, rejectUnauthorized: true, ...(options.ca ? { ca: options.ca } : {}) } : {}),
    });
    const timer = setTimeout(() => {
      req.destroy();
      done({ error: "PROBE_TIMEOUT" });
    }, options.timeoutMs);

    req.on("response", (res) => {
      const chunks: Buffer[] = [];
      let size = 0;
      const finish = () =>
        done({
          status: res.statusCode ?? 0,
          location: typeof res.headers.location === "string" ? res.headers.location : null,
          body: Buffer.concat(chunks).toString("utf8"),
          certificateExpires: https ? certificateExpiry(res) : null,
        });
      res.on("data", (chunk: Buffer) => {
        if (size >= maxBody) return;
        chunks.push(chunk.subarray(0, maxBody - size));
        size += chunk.length;
        if (size >= maxBody) {
          finish();
          req.destroy();
        }
      });
      res.on("end", finish);
      res.on("error", () => finish());
    });
    req.on("error", (err: NodeJS.ErrnoException) => done({ error: err.code }));
    req.end();
  });
}

/** Une réponse de Jellyfin : son identifiant, sans tirets, en minuscules. */
function jellyfinIdOf(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as { Id?: unknown; Version?: unknown };
    return typeof parsed.Id === "string" && typeof parsed.Version === "string" ? parsed.Id.replace(/-/g, "").toLowerCase() : null;
  } catch {
    return null;
  }
}

export async function probeTarget(input: ProbeInput, options: ProbeOptions): Promise<CheckTargetResult> {
  const { target } = input;
  if (target.host) {
    let addresses: string[];
    try {
      addresses = await (options.resolve ?? resolveHost)(target.host, input.family);
    } catch {
      return result("dns_error");
    }
    if (addresses.length === 0) return result("dns_error");
    if (!addresses.some((address) => sameIp(address, input.sourceIp))) return result("dns_mismatch");
  }

  const path = target.service === "tentacle" ? `${CHALLENGE_PATH_PREFIX}${input.challenge.id}` : "/System/Info/Public";
  const fetched = await fetchOnce(input, path, options);
  if ("error" in fetched) return result(classifyError(fetched.error));

  const { status, location, body, certificateExpires } = fetched;
  if (status >= 300 && status < 400) {
    // Le port 80 d'un mandataire renvoie vers HTTPS : c'est ce qu'on attend de lui.
    const toHttps = target.scheme === "http" && location !== null && /^https:\/\//i.test(location);
    return result(toHttps ? "redirect" : "http_error", status);
  }
  if (status === 200) {
    if (target.service === "tentacle") return result(body.trim() === input.challenge.token ? "open" : "wrong_service", status, certificateExpires);
    const id = jellyfinIdOf(body);
    const same = id !== null && (input.jellyfinId === undefined || id === input.jellyfinId);
    return result(same ? "open" : "wrong_service", status, certificateExpires);
  }
  // 404 : ce chemin n'existe pas là — un autre serveur, ou un autre Tentacle.
  return result(status === 404 ? "wrong_service" : "http_error", status);
}
