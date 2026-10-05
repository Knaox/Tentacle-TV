import { isPrivateIpv4 } from "@tentacle-tv/shared";

/**
 * L'adresse de ce serveur sur le réseau local, devinée depuis la page : si
 * l'administrateur la joint par une adresse IPv4 privée, c'est elle. Sinon
 * (domaine, HTTPS public, application de bureau), rien — il la saisit.
 */
export function guessLanUrl(location: Pick<Location, "protocol" | "hostname" | "host"> = window.location): string | null {
  if (location.protocol !== "http:" && location.protocol !== "https:") return null;
  return isPrivateIpv4(location.hostname) ? `${location.protocol}//${location.host}` : null;
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
