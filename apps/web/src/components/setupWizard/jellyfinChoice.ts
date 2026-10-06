import type { JellyfinProbeResult, SetupSelection } from "@tentacle-tv/shared";

/**
 * La règle du choix de Jellyfin, sans React : quel serveur proposer d'office,
 * comment le décrire, et ce que l'assistant fait ensuite de lui.
 */

/**
 * Le Jellyfin CONSEILLÉ (un badge, jamais un choix fait d'office) : celui de
 * la pile (pile complète), sinon le neuf (Tentacle le configure) ; aucun s'il
 * n'y a que des Jellyfin déjà configurés — à l'administrateur de dire lequel.
 */
export function recommendedUrl(servers: readonly JellyfinProbeResult[]): string | null {
  const usable = servers.filter((s) => s.compatible);
  return (usable.find((s) => s.inStack) ?? usable.find((s) => s.blank))?.url ?? null;
}

/** Le même serveur, vu par son adresse ou par son identifiant. */
export function sameServer(server: Pick<JellyfinProbeResult, "url" | "serverId">, selection: Pick<SetupSelection, "url" | "serverId"> | null): boolean {
  return !!selection && (server.url === selection.url || (!!server.serverId && server.serverId === selection.serverId));
}

/**
 * Le Jellyfin déjà choisi (un retour à cet écran) : toujours dans la liste,
 * et montré dans l'état de SON parcours — un Jellyfin neuf dont on vient de
 * créer le compte n'est plus vierge pour Jellyfin, il reste « neuf » ici.
 */
export function withSelection(servers: readonly JellyfinProbeResult[], selection: SetupSelection | null, clientUrl: string | null): JellyfinProbeResult[] {
  if (!selection) return [...servers];
  const blank = selection.path === "fresh";
  const found = servers.some((s) => sameServer(s, selection));
  const listed = servers.map((s) => (sameServer(s, selection) ? { ...s, blank } : s));
  if (found) return listed;
  const { url, serverId, serverName, version, inStack } = selection;
  return [{ url, serverId, serverName, version, inStack, blank, compatible: true, clientUrl }, ...listed];
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
