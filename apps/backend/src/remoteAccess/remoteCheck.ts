import { getDirectStreamingConfig, getJellyfinUrl, getPublicUrl } from "../services/configStore";
import { connectedJellyfinId } from "../services/serverLinks/serverLinksProbe";
import { issueChallenge, revokeChallenge } from "./challengeStore";
import { callCheckService } from "./checkClient";
import type { CheckTarget } from "./checkProtocol";
import { planCheckTargets } from "./checkTargets";
import type { RemoteCheckItem, RemoteCheckReport } from "./remoteAccessContract";
import { readRemoteAccessSettings, saveLastCheck } from "./remoteAccessSettings";

/**
 * Le test d'ouverture, de bout en bout : les cibles tirées des adresses
 * réglées, un défi par famille d'adresses, l'appel au service en IPv4 puis
 * en IPv6, et le rapport enregistré. Un seul test à la fois.
 *
 * Le service : `REMOTE_CHECK_URL` (par défaut check.tentacletv.app), `off`
 * pour le couper. Tant qu'il n'est pas en ligne, le test dit « service
 * indisponible » — jamais « fermé ».
 */
export const DEFAULT_CHECK_URL = "https://check.tentacletv.app";

export function checkServiceUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  const raw = env.REMOTE_CHECK_URL?.trim();
  if (!raw) return DEFAULT_CHECK_URL;
  if (["off", "false", "0", "none"].includes(raw.toLowerCase())) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null;
  } catch {
    return null;
  }
}

export function hostPort(env: NodeJS.ProcessEnv = process.env): number {
  const port = Number(env.TENTACLE_HOST_PORT || env.PORT || 3000);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : 3000;
}

export function jellyfinHostPort(env: NodeJS.ProcessEnv = process.env): number | null {
  const port = Number(env.JELLYFIN_HOST_PORT);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : null;
}

/** L'adresse publique de Jellyfin, seulement si la lecture directe s'en sert. */
export function activeJellyfinPublicUrl(): string | null {
  const direct = getDirectStreamingConfig();
  return direct.enabled ? direct.publicUrl : null;
}

/** Le port d'une adresse http(s), écrit ou par défaut ; `null` si illisible. */
function portOf(url: string | null): number | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return Number(parsed.port) || (parsed.protocol === "https:" ? 443 : 80);
  } catch {
    return null;
  }
}

/**
 * Le port de Jellyfin vu du réseau local : celui que la pile publie, sinon
 * celui de son adresse privée (un Jellyfin hors de la pile, natif ou à côté).
 */
export function jellyfinLanPort(env: NodeJS.ProcessEnv = process.env): number | null {
  return jellyfinHostPort(env) ?? portOf(getDirectStreamingConfig().privateUrl);
}

function itemsFor(targets: CheckTarget[], family: 4 | 6, fill: (index: number) => Pick<RemoteCheckItem, "verdict" | "httpStatus" | "certificateExpires">): RemoteCheckItem[] {
  return targets.map((t, i) => ({ service: t.service, scheme: t.scheme, port: t.port, host: t.host ?? null, family, ...fill(i) }));
}

const NOT_TESTABLE = { verdict: "not_testable", httpStatus: null, certificateExpires: null } as const;

async function expectedJellyfinId(): Promise<string | undefined> {
  const id = await connectedJellyfinId(getJellyfinUrl()).catch(() => null);
  const clean = id?.replace(/-/g, "").toLowerCase();
  return clean && /^[0-9a-f]{32}$/.test(clean) ? clean : undefined;
}

async function performCheck(): Promise<RemoteCheckReport> {
  const settings = readRemoteAccessSettings();
  const targets = planCheckTargets({ publicUrl: getPublicUrl(), jellyfinPublicUrl: activeJellyfinPublicUrl(), proxy: settings.proxy, hostPort: hostPort() });
  const report: RemoteCheckReport = { checkedAt: new Date().toISOString(), outcome: "done", publicIp: { v4: null, v6: null }, items: [] };
  const serviceUrl = checkServiceUrl();
  if (!serviceUrl) return { ...report, outcome: "service_disabled" };
  if (targets.length === 0) return { ...report, outcome: "nothing_to_check" };
  const jellyfinId = targets.some((t) => t.service === "jellyfin") ? await expectedJellyfinId() : undefined;

  for (const family of [4, 6] as const) {
    const challenge = issueChallenge();
    try {
      const call = await callCheckService(serviceUrl, { challenge, ...(jellyfinId ? { jellyfinId } : {}), targets }, family);
      if (call.kind === "ok") {
        report.publicIp[family === 4 ? "v4" : "v6"] = call.response.sourceIp;
        report.items.push(...itemsFor(targets, family, (i) => call.response.results[i]));
      } else if (family === 4 && call.kind !== "family_unavailable") {
        // Sans réponse en IPv4, rien n'est jugé : le service manque, ou il freine.
        return { ...report, outcome: call.kind === "rate_limited" ? "rate_limited" : "service_unavailable", items: [] };
      } else {
        report.items.push(...itemsFor(targets, family, () => NOT_TESTABLE));
      }
    } finally {
      revokeChallenge(challenge.id);
    }
  }
  return report;
}

let running: Promise<RemoteCheckReport> | null = null;

export function runRemoteCheck(): Promise<RemoteCheckReport> {
  if (!running) {
    running = performCheck()
      .then(async (report) => {
        await saveLastCheck(report);
        return report;
      })
      .finally(() => {
        running = null;
      });
  }
  return running;
}
