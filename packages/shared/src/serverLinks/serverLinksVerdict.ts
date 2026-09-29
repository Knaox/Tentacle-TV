import type { LinkProbe, ServerLinksReport } from "./serverLinksContract";

/**
 * Le verdict des liens du serveur — une seule règle, lue par la vue
 * d'ensemble de l'administration ET par l'assistant d'installation : ce qui
 * est fait, ce qui reste à faire, et pourquoi une adresse renseignée ne
 * suffit pas (joignable seulement du domicile, sans HTTPS, refusée aux
 * navigateurs…). Logique pure : le rapport sondé entre, les états sortent.
 *
 * Une sonde qui échoue ne rend jamais une adresse « fausse » : le serveur se
 * joint parfois mal par son adresse publique (routeurs sans NAT en boucle),
 * alors qu'un téléphone en 4G y arrive. On dit « à vérifier », pas « cassé ».
 */

export type LinkCheckId = "publicUrl" | "directPlay";

/** `done` : réglé et vérifié ; `todo` : pas réglé ; `attention` : réglé, avec un souci ; `unknown` : pas sondé. */
export type LinkCheckState = "done" | "todo" | "attention" | "unknown";

export type LinkRole = "tentacle" | "jellyfinPublic" | "jellyfinPrivate";

export type LinkIssue =
  /** Une adresse du réseau local là où il faut une adresse d'Internet. */
  | "not-public"
  /** Une adresse que seul le serveur comprend : `localhost`, un nom de conteneur Docker. */
  | "internal-host"
  | "not-https"
  /** Jellyfin en http:// derrière un Tentacle en https:// : le navigateur bloque. */
  | "mixed-content"
  | "cors-missing"
  | "other-server"
  | "unexpected"
  | "http-error"
  /** Le serveur ne s'est pas joint par là — à vérifier depuis un autre réseau. */
  | "unverified";

export type LinkTone = "success" | "warning" | "neutral";

export interface LinkEndpointVerdict {
  role: LinkRole;
  url: string | null;
  probe: LinkProbe | null;
  tone: LinkTone;
  issues: LinkIssue[];
}

/** Ce que la ligne dit en plus de ses adresses. */
export type LinkNote = "direct-disabled" | "legacy-relayed" | "from-env";

export interface LinkCheck {
  id: LinkCheckId;
  state: LinkCheckState;
  endpoints: LinkEndpointVerdict[];
  notes: LinkNote[];
}

/**
 * Le pourquoi de chaque recommandation, dans l'ordre où on le lit. Les mots
 * vivent dans l'espace i18n `serverLinks` (`benefit_<check>_<clé>`).
 */
export const LINK_BENEFITS: Record<LinkCheckId, readonly string[]> = {
  publicUrl: ["away", "apps", "shares"],
  directPlay: ["quality", "load", "local"],
};

export type LinkHostKind = "loopback" | "private" | "internal-name" | "public" | "invalid";

const PRIVATE_SUFFIXES = [".local", ".lan", ".home", ".internal", ".home.arpa", ".localdomain"];

function privateIpv4(host: string): boolean {
  const parts = host.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts as [number, number];
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127);
}

/**
 * Où mène une adresse : la machine elle-même, le réseau local (IP privée,
 * `.local`, CGNAT de Tailscale), un nom qui n'existe que dans Docker
 * (`jellyfin`), ou Internet.
 */
export function linkHostKind(url: string): LinkHostKind {
  let host: string;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "invalid";
    host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  } catch {
    return "invalid";
  }
  if (host === "") return "invalid";
  if (host === "localhost" || host.endsWith(".localhost") || host === "::1" || /^127\./.test(host) || host === "0.0.0.0") return "loopback";
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return privateIpv4(host) ? "private" : "public";
  if (host.includes(":")) return /^(fc|fd|fe80)/.test(host) ? "private" : "public";
  if (!host.includes(".")) return "internal-name";
  return PRIVATE_SUFFIXES.some((suffix) => host.endsWith(suffix)) ? "private" : "public";
}

/** Une adresse absolue en http(s), sans barre finale ; la chaîne vide reste vide. */
export function normalizeLinkUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export function isLinkUrl(value: string): boolean {
  return linkHostKind(value) !== "invalid";
}

const isHttps = (url: string) => url.trim().toLowerCase().startsWith("https://");

function probeIssues(probe: LinkProbe | null): LinkIssue[] {
  switch (probe?.result) {
    case "other-server":
    case "unexpected":
    case "http-error":
      return [probe.result];
    case "unreachable":
    case "timeout":
      return ["unverified"];
    default:
      return [];
  }
}

function endpoint(role: LinkRole, url: string | null, probe: LinkProbe | null, issues: LinkIssue[]): LinkEndpointVerdict {
  const all = [...issues, ...probeIssues(probe)];
  const tone: LinkTone = !url ? "neutral" : all.length > 0 ? "warning" : probe?.result === "ok" ? "success" : "neutral";
  return { role, url, probe, tone, issues: all };
}

/** Les soucis d'une adresse qui doit se joindre depuis Internet. */
function publicIssues(url: string, needsHttps: boolean): LinkIssue[] {
  const kind = linkHostKind(url);
  const issues: LinkIssue[] = [];
  if (kind === "loopback" || kind === "internal-name") issues.push("internal-host");
  else if (kind === "private") issues.push("not-public");
  if (needsHttps && !isHttps(url)) issues.push("not-https");
  return issues;
}

function stateOf(endpoints: LinkEndpointVerdict[]): LinkCheckState {
  const filled = endpoints.filter((e) => e.url);
  if (filled.some((e) => e.issues.length > 0)) return "attention";
  if (filled.some((e) => e.probe === null)) return "unknown";
  return "done";
}

function publicUrlCheck(report: ServerLinksReport): LinkCheck {
  const { url, probe, source } = report.tentacle;
  const notes: LinkNote[] = source === "env" ? ["from-env"] : [];
  if (!url) return { id: "publicUrl", state: "todo", endpoints: [endpoint("tentacle", null, null, [])], notes };
  const tentacle = endpoint("tentacle", url, probe, publicIssues(url, true));
  return { id: "publicUrl", state: stateOf([tentacle]), endpoints: [tentacle], notes };
}

function directPlayCheck(report: ServerLinksReport): LinkCheck {
  const { enabled, publicUrl, privateUrl, publicProbe, privateProbe } = report.direct;
  const publicSide: LinkIssue[] = publicUrl ? publicIssues(publicUrl, false) : [];
  // Un navigateur sur la page https:// de Tentacle refuse un flux en http://.
  if (publicUrl && report.tentacle.url && isHttps(report.tentacle.url) && !isHttps(publicUrl)) publicSide.push("mixed-content");
  if (publicUrl && publicProbe?.result === "ok" && publicProbe.cors === false) publicSide.push("cors-missing");
  const privateKind = privateUrl ? linkHostKind(privateUrl) : null;
  const privateSide: LinkIssue[] = privateKind === "loopback" || privateKind === "internal-name" ? ["internal-host"] : [];
  const endpoints = [
    endpoint("jellyfinPublic", publicUrl, publicProbe, publicSide),
    endpoint("jellyfinPrivate", privateUrl, privateProbe, privateSide),
  ];
  if (!enabled || !publicUrl || !privateUrl) {
    return { id: "directPlay", state: "todo", endpoints, notes: ["direct-disabled"] };
  }
  return {
    id: "directPlay",
    state: stateOf(endpoints),
    endpoints,
    notes: report.legacyClientsRelayed ? ["legacy-relayed"] : [],
  };
}

export function evaluateServerLinks(report: ServerLinksReport): LinkCheck[] {
  return [publicUrlCheck(report), directPlayCheck(report)];
}

/** L'avancement, comme la liste des réglages de Jellyfin : ce qui est fait, sur ce qui se fait. */
export function linksProgress(checks: readonly LinkCheck[]): { done: number; total: number } {
  return { done: checks.filter((check) => check.state === "done").length, total: checks.length };
}

/**
 * Ce que l'assistant propose avant qu'on tape quoi que ce soit : l'adresse de
 * la page si on installe depuis Internet (c'est alors le lien public), et
 * l'adresse de Jellyfin donnée à l'étape précédente si elle est sur le réseau
 * local (c'est alors celle de la lecture directe à la maison).
 */
export function suggestServerLinks(input: { pageOrigin: string; jellyfinUrl: string | null }): {
  publicUrl: string;
  jellyfinPrivateUrl: string;
} {
  const page = normalizeLinkUrl(input.pageOrigin);
  const jellyfin = normalizeLinkUrl(input.jellyfinUrl ?? "");
  return {
    publicUrl: linkHostKind(page) === "public" ? page : "",
    jellyfinPrivateUrl: linkHostKind(jellyfin) === "private" ? jellyfin : "",
  };
}
