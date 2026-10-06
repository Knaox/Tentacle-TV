import { resolveCompat } from "../../services/jellyfinCompat/compatVerdict";
import { getCompatManifestState } from "../../services/jellyfinCompat/manifestStore";
import { BACKEND_VERSION } from "../../services/version";
import { SetupError } from "../setupErrors";
import type { JellyfinProbeResult } from "../setupDiscoveryContract";
import { isLoopbackName } from "./addressGuard";
import { jellyfinRequest, loopbackAllowed } from "./guardedFetch";

/**
 * « Y a-t-il un Jellyfin à cette adresse, et lequel ? » — `GET
 * /System/Info/Public`, anonyme, seul appel de la sonde. Rien de plus ne sort
 * de la réponse que les champs lus ici.
 */
export interface ProbedJellyfin extends Omit<JellyfinProbeResult, "clientUrl"> {
  /** L'identifiant du serveur : ce qui prouve, plus tard, que c'est bien LE même. */
  id: string;
}

const INFO_PATH = "/System/Info/Public";

/**
 * L'adresse saisie, ramenée à sa base : `http(s)`, sans identifiants, sans
 * requête ni fragment, sans barre finale. Un chemin reste permis (Jellyfin
 * servi sous `/jellyfin`). Sans protocole, `http://` est supposé.
 */
export function normalizeJellyfinUrl(input: string): string {
  const raw = input.trim();
  if (!raw || raw.length > 2048) throw new SetupError("jf_invalid_url");
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `http://${raw}`);
  } catch {
    throw new SetupError("jf_invalid_url");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new SetupError("jf_invalid_url");
  if (url.username || url.password || !url.hostname) throw new SetupError("jf_invalid_url");
  if (!loopbackAllowed() && isLoopbackName(url.hostname)) throw new SetupError("jf_localhost_in_docker");
  const path = url.pathname.replace(/\/+$/, "");
  return `${url.protocol}//${url.host}${path}`;
}

interface PublicInfo {
  Id?: unknown;
  Version?: unknown;
  ServerName?: unknown;
  ProductName?: unknown;
  StartupWizardCompleted?: unknown;
}

function readInfo(json: unknown): { id: string; version: string; serverName: string; blank: boolean } {
  const info = (json ?? {}) as PublicInfo;
  const product = typeof info.ProductName === "string" ? info.ProductName : "";
  if (typeof info.Id !== "string" || !info.Id || typeof info.Version !== "string" || !info.Version) {
    throw new SetupError("jf_not_jellyfin");
  }
  // Emby répond à la même route : son nom de produit le trahit.
  if (product && !/jellyfin/i.test(product)) throw new SetupError("jf_not_jellyfin");
  return {
    id: info.Id,
    version: info.Version,
    serverName: typeof info.ServerName === "string" ? info.ServerName.slice(0, 100) : "",
    blank: info.StartupWizardCompleted === false,
  };
}

/**
 * Une seule redirection suivie, et seulement vers le MÊME hôte (le passage de
 * `http` à `https` d'un mandataire, un chemin ajouté) : l'adresse retenue est
 * alors celle d'arrivée.
 */
function redirectedBase(from: string, location: string | null): string | null {
  if (!location) return null;
  let target: URL;
  try {
    target = new URL(location, `${from}${INFO_PATH}`);
  } catch {
    return null;
  }
  if (target.hostname !== new URL(from).hostname) return null;
  if (!target.pathname.toLowerCase().endsWith(INFO_PATH.toLowerCase())) return null;
  return normalizeJellyfinUrl(`${target.protocol}//${target.host}${target.pathname.slice(0, -INFO_PATH.length)}`);
}

export async function probeJellyfin(input: string): Promise<ProbedJellyfin> {
  let url = normalizeJellyfinUrl(input);
  let reply = await jellyfinRequest(url, INFO_PATH, { timeoutMs: 4_000, maxBytes: 64 * 1024 });
  if (reply.status >= 300 && reply.status < 400) {
    const next = redirectedBase(url, reply.location);
    if (!next) throw new SetupError("jf_not_jellyfin");
    url = next;
    reply = await jellyfinRequest(url, INFO_PATH, { timeoutMs: 4_000, maxBytes: 64 * 1024 });
  }
  if (reply.status !== 200) throw new SetupError("jf_not_jellyfin");

  const info = readInfo(reply.json);
  const compat = resolveCompat(getCompatManifestState().manifest, info.version, BACKEND_VERSION);
  return { url, ...info, compatible: compat.status !== "incompatible" };
}
