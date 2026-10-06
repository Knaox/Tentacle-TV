import type { JellyfinProbeResult } from "@tentacle-tv/shared";

/**
 * La règle du choix de Jellyfin, sans React : quel serveur proposer d'office,
 * comment le décrire, et ce que l'assistant fait ensuite de lui.
 */

/** Le vierge d'abord (Tentacle le configure), sinon le premier compatible ; jamais un incompatible. */
export function preselectedUrl(servers: readonly JellyfinProbeResult[]): string | null {
  return (servers.find((s) => s.compatible && s.blank) ?? servers.find((s) => s.compatible))?.url ?? null;
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
