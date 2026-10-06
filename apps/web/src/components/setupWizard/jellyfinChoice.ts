import type { JellyfinProbeResult } from "@tentacle-tv/shared";

/**
 * La règle du choix de Jellyfin, sans React : quel serveur proposer d'office,
 * comment le décrire, et ce que l'assistant fait ensuite de lui.
 */

/**
 * Celui de la pile d'abord (pile complète), sinon le neuf (Tentacle le
 * configure), sinon le premier compatible ; jamais un incompatible.
 */
export function preselectedUrl(servers: readonly JellyfinProbeResult[]): string | null {
  const usable = servers.filter((s) => s.compatible);
  return (usable.find((s) => s.inStack) ?? usable.find((s) => s.blank) ?? usable[0])?.url ?? null;
}

/**
 * Une seule liste : celui de la pile en tête, puis ce que la découverte a
 * trouvé, puis les adresses saisies. Un même serveur (même identifiant) vu
 * par deux chemins ne compte qu'une fois — le premier l'emporte.
 */
export function mergeServers(
  stack: JellyfinProbeResult | null,
  found: readonly JellyfinProbeResult[],
  manual: readonly JellyfinProbeResult[],
): JellyfinProbeResult[] {
  const seen = new Set<string>();
  const list: JellyfinProbeResult[] = [];
  for (const server of [...(stack ? [stack] : []), ...found, ...manual]) {
    const key = server.serverId || server.url;
    if (seen.has(key) || seen.has(server.url)) continue;
    seen.add(key);
    seen.add(server.url);
    list.push(server);
  }
  return list;
}

export interface ServerGroups {
  /** Le Jellyfin de cette pile (pile complète), toujours en tête. */
  stack: JellyfinProbeResult | null;
  /** NEUFS : Tentacle crée le compte et les bibliothèques. */
  fresh: JellyfinProbeResult[];
  /** DÉJÀ CONFIGURÉS : un compte administrateur existant, rien n'y est créé. */
  configured: JellyfinProbeResult[];
  incompatible: JellyfinProbeResult[];
}

export function groupServers(servers: readonly JellyfinProbeResult[]): ServerGroups {
  const stack = servers.find((s) => s.inStack) ?? null;
  const others = servers.filter((s) => s !== stack);
  return {
    stack,
    fresh: others.filter((s) => serverState(s) === "blank"),
    configured: others.filter((s) => serverState(s) === "configured"),
    incompatible: others.filter((s) => serverState(s) === "incompatible"),
  };
}

/** L'adresse et le port lisibles d'une entrée (`172.16.1.30` et `47896`). */
export function hostAndPort(url: string): { host: string; port: string } {
  try {
    const parsed = new URL(url);
    return { host: parsed.hostname, port: parsed.port || (parsed.protocol === "https:" ? "443" : "80") };
  } catch {
    return { host: url, port: "" };
  }
}

export type ServerState = "blank" | "configured" | "incompatible";

export function serverState(server: JellyfinProbeResult): ServerState {
  if (!server.compatible) return "incompatible";
  return server.blank ? "blank" : "configured";
}

/** Une entrée saisie à la main rejoint la liste (une seule fois par adresse), choisie. */
export function withManual(servers: readonly JellyfinProbeResult[], manual: JellyfinProbeResult): JellyfinProbeResult[] {
  return [manual, ...servers.filter((s) => s.url !== manual.url)];
}

/** Une adresse d'applications acceptable : http(s), sans identifiants. */
export function isValidClientUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password && !url.search && !url.hash;
  } catch {
    return false;
  }
}
