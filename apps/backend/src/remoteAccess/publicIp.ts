import { request as httpsRequest } from "https";
import { isIP } from "net";
import type { PublicIpReport } from "./remoteAccessContract";
import { readLastCheck } from "./remoteAccessSettings";
import { checkServiceUrl } from "./remoteCheck";

/**
 * L'adresse publique du serveur, pour l'écran de l'accès à distance : celle
 * qu'a vue le dernier test d'ouverture, sinon celle que rend un service
 * d'écho (la page « trace » de Cloudflare, en IPv4 forcé — sans compte, sans
 * jeton). Au plus une demande toutes les dix minutes ; `REMOTE_CHECK_URL=off`
 * coupe aussi ceci : aucun appel vers l'extérieur.
 */
export const ECHO_URL = "https://cloudflare.com/cdn-cgi/trace";
const CACHE_MS = 10 * 60_000;
const TIMEOUT_MS = 5_000;

export type EchoFetcher = (url: string) => Promise<string | null>;
/** Le service de test répond-il ? (`GET /healthz`, cinq secondes au plus) */
export type HealthProbe = (serviceUrl: string) => Promise<boolean>;

const probeHealth: HealthProbe = (serviceUrl) =>
  fetch(new URL("/healthz", serviceUrl), { signal: AbortSignal.timeout(TIMEOUT_MS) }).then((res) => res.ok, () => false);

/** Une demande en IPv4 : c'est l'adresse que la box redirige. Le corps est court (< 1 Ko). */
const fetchEcho: EchoFetcher = (url) =>
  new Promise((resolve) => {
    const req = httpsRequest(url, { family: 4, timeout: TIMEOUT_MS, headers: { "user-agent": "Tentacle" } }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk: string) => {
        body += chunk;
        if (body.length > 4096) req.destroy();
      });
      res.on("end", () => resolve(res.statusCode === 200 ? body : null));
    });
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve(null));
    req.end();
  });

/** `ip=203.0.113.5` dans la page « trace » ; une adresse IPv4 seulement. */
export function parseTrace(body: string): string | null {
  const ip = body.match(/^ip=(.+)$/m)?.[1]?.trim() ?? "";
  return isIP(ip) === 4 ? ip : null;
}

let cached: { at: number; report: PublicIpReport } | null = null;

export function resetPublicIpCache(): void {
  cached = null;
}

export async function detectPublicIp(fetcher: EchoFetcher = fetchEcho, now: () => number = Date.now, health: HealthProbe = probeHealth): Promise<PublicIpReport> {
  const none = { v4: null, v6: null, source: null, detectedAt: null };
  const serviceUrl = checkServiceUrl();
  if (!serviceUrl) return { outcome: "disabled", ...none };
  if (cached && now() - cached.at < CACHE_MS) return cached.report;
  const last = readLastCheck();
  const fromCheck = last?.outcome === "done" && (last.publicIp.v4 || last.publicIp.v6) ? last : null;
  const [online, echo] = await Promise.all([health(serviceUrl), fromCheck ? Promise.resolve(null) : fetcher(ECHO_URL)]);
  const checkService = online ? ("online" as const) : ("offline" as const);
  const v4 = parseTrace(echo ?? "");
  const report: PublicIpReport = fromCheck
    ? { outcome: "found", v4: fromCheck.publicIp.v4, v6: fromCheck.publicIp.v6, source: "check", detectedAt: fromCheck.checkedAt, checkService }
    : v4
      ? { outcome: "found", v4, v6: null, source: "echo", detectedAt: new Date(now()).toISOString(), checkService }
      : { outcome: "unavailable", ...none, checkService };
  cached = { at: now(), report };
  return report;
}

/** Un test vient de tourner : la prochaine lecture repart de son rapport. */
export function forgetPublicIp(): void {
  cached = null;
}
