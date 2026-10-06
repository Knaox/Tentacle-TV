import { isIP } from "net";
import type { Deployment } from "../deployment";
import { isLoopbackName } from "./addressGuard";

/**
 * L'adresse de Jellyfin que les APPLICATIONS recevront (lecture directe,
 * `jellyfin_private_url`, `GET /api/config`). Ce n'est PAS celle par laquelle
 * le serveur joint Jellyfin : dans la pile complète, celle-là est un nom du
 * réseau Docker (`http://jellyfin:8096`) qu'aucun téléphone ne résout.
 *
 * La règle : l'hôte par lequel l'administrateur a ouvert l'assistant (il joint
 * cette machine, ses appareils aussi) et le port réellement publié.
 *
 *  - pile complète : `JELLYFIN_HOST_PORT`, et rien si la pile ne le déclare
 *    pas — jamais 8096 supposé ;
 *  - ailleurs : l'adresse du Jellyfin choisi, sauf si elle ne vaut que pour
 *    le serveur (boucle locale, `host.docker.internal`, nom Docker sans point)
 *    — l'hôte y est remplacé par celui du navigateur, le port gardé.
 *
 * Proposée seulement : l'administrateur la revoit au récapitulatif.
 */
export interface ClientUrlInput {
  deployment: Pick<Deployment, "siblingUrl" | "jellyfinHostPort">;
  /** L'hôte de la requête (`request.hostname`), sans port. */
  browserHost: string | undefined;
  /** L'adresse par laquelle le serveur joint ce Jellyfin (absente : pas encore choisi). */
  jellyfinUrl?: string | null;
}

/** Un hôte que seul le serveur sait joindre. */
export function isServerOnlyHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[(.*)\]$/, "$1");
  if (isLoopbackName(host) || host === "host.docker.internal" || host === "host.containers.internal") return true;
  return isIP(host) === 0 && !host.includes(".");
}

/** L'hôte du navigateur, propre à entrer dans une URL ; `null` s'il est absent ou douteux. */
export function cleanBrowserHost(raw: string | undefined): string | null {
  const host = raw?.trim().toLowerCase().replace(/^\[(.*)\]$/, "$1");
  if (!host || host.length > 253) return null;
  if (isIP(host) === 6) return `[${host}]`;
  return /^[a-z0-9.-]+$/.test(host) ? host : null;
}

export function clientJellyfinUrl(input: ClientUrlInput): string | null {
  const browser = cleanBrowserHost(input.browserHost);
  if (input.deployment.siblingUrl) {
    const port = input.deployment.jellyfinHostPort;
    return browser && port ? `http://${browser}:${port}` : null;
  }
  if (!input.jellyfinUrl) return null;
  let url: URL;
  try {
    url = new URL(input.jellyfinUrl);
  } catch {
    return null;
  }
  if (!isServerOnlyHost(url.hostname)) return input.jellyfinUrl;
  if (!browser) return null;
  url.hostname = browser;
  return url.toString().replace(/\/+$/, "");
}
