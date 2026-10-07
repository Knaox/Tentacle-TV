import { isPrivateIpv4, isValidUpstreamHost, type RemoteAccessState } from "@tentacle-tv/shared";

/**
 * L'adresse de ce serveur sur le réseau local, devinée depuis la page : si
 * l'administrateur la joint par une adresse IPv4 privée, c'est elle. Sinon
 * (domaine, HTTPS public, application de bureau), rien — il la saisit.
 */
export function guessLanUrl(location: Pick<Location, "protocol" | "hostname" | "host"> = window.location): string | null {
  if (location.protocol !== "http:" && location.protocol !== "https:") return null;
  return isPrivateIpv4(location.hostname) ? `${location.protocol}//${location.host}` : null;
}

/**
 * L'adresse locale de Tentacle, d'où qu'on ouvre la page : réglée, sinon
 * celle par laquelle le SERVEUR voit arriver cette requête (une IP privée —
 * seule source dans l'application de bureau, dont la page n'a pas d'adresse
 * réseau), sinon celle de la page.
 */
export function homeTentacleUrl(state: Pick<RemoteAccessState, "settings" | "derivedLocalUrl">, location?: Pick<Location, "protocol" | "hostname" | "host">): string | null {
  if (state.settings.localUrl) return state.settings.localUrl;
  try {
    if (state.derivedLocalUrl && isPrivateIpv4(new URL(state.derivedLocalUrl).hostname)) return state.derivedLocalUrl;
  } catch {
    // Une adresse illisible : on passe à la suivante.
  }
  return guessLanUrl(location);
}

/** La page est servie en HTTP clair depuis le réseau local (ou la machine). */
export function isLocalHttp(location: Pick<Location, "protocol" | "hostname"> = window.location): boolean {
  if (location.protocol !== "http:") return false;
  return isPrivateIpv4(location.hostname) || location.hostname === "localhost" || location.hostname === "127.0.0.1";
}

/** Une adresse http(s) que le serveur acceptera comme adresse locale. */
export function isValidLocalUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return (url.protocol === "http:" || url.protocol === "https:") && url.hostname !== "" && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** `hôte:port` d'une adresse (`http://192.168.1.50:8096/jf` → `192.168.1.50:8096`), le port par défaut du schéma écrit. */
export function hostPortOf(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return `${parsed.hostname.includes(":") && !parsed.hostname.startsWith("[") ? `[${parsed.hostname}]` : parsed.hostname}:${parsed.port || (parsed.protocol === "https:" ? 443 : 80)}`;
  } catch {
    return null;
  }
}

/** Lit `hôte:port` (`192.168.1.20:3000`, `tentacle:3000`, `[fd00::20]:3000`) ; `null` si illisible. */
export function parseHostPort(value: string): { host: string; port: number } | null {
  const match = value.trim().match(/^(\[[0-9a-fA-F:.]+\]|[A-Za-z0-9.-]+):(\d{1,5})$/);
  if (!match) return null;
  const port = Number(match[2]);
  if (port < 1 || port > 65535 || !isValidUpstreamHost(match[1])) return null;
  return { host: match[1], port };
}
