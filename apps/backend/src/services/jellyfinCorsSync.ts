import { getConfigValue, getJellyfinApiKey, getJellyfinUrl, getPublicUrl } from "./configStore";
import { DESKTOP_APP_ORIGINS, injectCorsHosts, originOf } from "./jellyfinCors";
import { onJellyfinHealth } from "./jellyfinHealth";
import { isPrivateIp } from "./networkUtils";

/**
 * Les `CorsHosts` de Jellyfin tenus À JOUR par Tentacle, sans geste de
 * l'administrateur : chaque origine par laquelle une application web de
 * Tentacle appelle Jellyfin (lecture directe) y est inscrite — le lien public,
 * l'adresse de ce serveur sur le réseau local, l'application de bureau, et la
 * page de l'administrateur qui enregistre ou teste. Une liste ouverte (vide ou
 * `*`) n'est jamais touchée (`jellyfinCors.ts`).
 *
 * Quand : au démarrage, à chaque retour de Jellyfin (redémarré, réinstallé),
 * à chaque enregistrement d'une adresse, à chaque test de la lecture directe,
 * et à l'ouverture de la page « Accès à distance ». Les passages sont mis à la
 * file : deux lectures-écritures de la configuration de Jellyfin ne se
 * croisent jamais.
 */

export type CorsSyncStatus = "open" | "ready" | "updated" | "unreachable" | "not_configured";

export interface CorsSyncReport {
  /** `open` : Jellyfin accepte toutes les origines ; `ready` : les nôtres y étaient ; `updated` : ajoutées. */
  status: CorsSyncStatus;
  /** Les origines de Tentacle que Jellyfin doit accepter. */
  origins: string[];
  /** Celles que ce passage vient d'ajouter. */
  added: string[];
}

const LOCAL_URL_KEY = "remote_access_local_url";

/**
 * Une origine de requête qu'on inscrit sans qu'elle soit réglée : l'appli de
 * bureau, la machine, le réseau local. Une origine publique inconnue n'entre
 * que si un administrateur l'apporte (`trustRequestOrigin`).
 */
export function isHomeOrigin(origin: string): boolean {
  if ((DESKTOP_APP_ORIGINS as readonly string[]).includes(origin)) return true;
  try {
    const host = new URL(origin).hostname.replace(/^\[|\]$/g, "");
    return host === "localhost" || isPrivateIp(host);
  } catch {
    return false;
  }
}

/** Les origines de Tentacle que Jellyfin doit accepter, dans l'ordre, sans doublon. */
export function tentacleCorsOrigins(input: { publicUrl: string | null; localUrl: string | null; extra?: Array<string | null | undefined> }): string[] {
  const all = [input.publicUrl, input.localUrl, ...(input.extra ?? []), ...DESKTOP_APP_ORIGINS].map(originOf);
  return [...new Set(all.filter((origin): origin is string => origin !== null))];
}

interface SyncOptions {
  /** L'origine de la requête qui déclenche (en-tête `Origin`). */
  requestOrigin?: string;
  /** Un administrateur l'apporte : elle est inscrite même publique. */
  trustRequestOrigin?: boolean;
  logger?: { info: (...args: unknown[]) => void; warn: (...args: unknown[]) => void };
}

let queue: Promise<unknown> = Promise.resolve();

async function runSync(options: SyncOptions): Promise<CorsSyncReport> {
  const origin = options.requestOrigin ? originOf(options.requestOrigin) : null;
  const extra = origin && (options.trustRequestOrigin || isHomeOrigin(origin)) ? [origin] : [];
  const origins = tentacleCorsOrigins({ publicUrl: getPublicUrl(), localUrl: getConfigValue(LOCAL_URL_KEY) ?? null, extra });
  const jellyfinUrl = getJellyfinUrl();
  const apiKey = getJellyfinApiKey();
  if (!jellyfinUrl || !apiKey) return { status: "not_configured", origins, added: [] };
  try {
    const result = await injectCorsHosts(jellyfinUrl, apiKey, origins, options.logger);
    if (result.added.length) console.log(`[cors] origines ajoutées aux CorsHosts de Jellyfin : ${result.added.join(", ")}`);
    return { status: result.open ? "open" : result.added.length ? "updated" : "ready", origins, added: result.added };
  } catch (err) {
    console.warn("[cors] CorsHosts de Jellyfin non vérifiés :", err instanceof Error ? err.message : err);
    return { status: "unreachable", origins, added: [] };
  }
}

/** Un passage, mis à la file. Ne lève jamais : un Jellyfin injoignable donne `unreachable`. */
export function syncJellyfinCors(options: SyncOptions = {}): Promise<CorsSyncReport> {
  const next = queue.then(() => runSync(options));
  queue = next.catch(() => undefined);
  return next;
}

let started = false;

/** Au démarrage d'un serveur installé, puis à chaque retour de Jellyfin. */
export function startJellyfinCorsSync(): void {
  if (started) return;
  started = true;
  void syncJellyfinCors();
  onJellyfinHealth((next, previous) => {
    if (next.state === "up" && previous.state !== "up") void syncJellyfinCors();
  });
}
