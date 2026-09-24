import { JELLYFIN_AUTH_HEADER, JELLYFIN_TOKEN_HEADER } from "@tentacle-tv/shared";
import type { JellyfinClient } from "../jellyfin";

/**
 * Mesure du débit RÉEL de la connexion via le téléchargement témoin Jellyfin
 * `GET /Playback/BitrateTest?size=N` (N octets aléatoires, servis à travers le
 * proxy Tentacle — entrée de liste blanche dédiée côté backend).
 *
 * Usage : les clients TV appellent `primeBitrateMeasure(client)` tôt (montage de
 * l'accueil / du lecteur), puis lisent `cachedBitrate()` au moment de choisir la
 * qualité. La mesure est UNE photographie, pas un tuner permanent : cache de
 * 10 min, single-flight, et tout échec (proxy sans l'entrée, timeout, réseau)
 * rend `null` — l'appelant n'applique alors AUCUN cap (dégradation gracieuse,
 * indispensable face à un serveur pas encore à jour).
 *
 * **La mesure suit la voie du média.** Avec `preferDirect`, et quand le direct
 * streaming est actif, le témoin part vers le serveur Jellyfin lui-même — là
 * où iront les segments. Mesurer le proxy quand le film passe à côté bridait
 * à tort : une Apple TV en Wi-Fi mesurait 18 Mb/s à travers un Tentacle
 * distant et transcodait en 720p un 4K HDR que son réseau local portait sans
 * peine. Réservé aux runtimes sans CORS (clients natifs) : une page web qui
 * appellerait Jellyfin en direct se heurterait au mur de l'origine.
 */

const SIZE_BYTES = 3_000_000;
const TIMEOUT_MS = 8_000;
const CACHE_MS = 10 * 60_000;
// Bornes de vraisemblance : en dessous, la mesure dit surtout que le réseau
// était en panne ; au-dessus, que le corps était déjà dans un cache local.
const MIN_BPS = 100_000;
const MAX_BPS = 1_000_000_000;

export interface BitrateMeasureOptions {
  /** Mesurer la voie directe (serveur Jellyfin) quand le direct streaming est actif. */
  preferDirect?: boolean;
}

interface MeasureRoute {
  /** Clé de cache : une mesure de la voie proxy ne vaut pas pour la voie directe. */
  key: string;
  url: string;
  headers: Record<string, string>;
  withCookies: boolean;
}

let measuredBps: number | null = null;
let measuredAt = 0;
let measuredRoute: string | null = null;
let inFlight: Promise<number | null> | null = null;
let inFlightRoute: string | null = null;

/** Dernière mesure (bits/s) si elle a moins de 10 min, sinon null. */
export function cachedBitrate(): number | null {
  if (measuredBps == null) return null;
  return Date.now() - measuredAt <= CACHE_MS ? measuredBps : null;
}

/** La voie à mesurer : directe si demandée et disponible, sinon le proxy. */
function routeFor(client: JellyfinClient, options: BitrateMeasureOptions): MeasureRoute {
  const direct = options.preferDirect ? client.getDirectStreaming?.() : null;
  if (direct?.enabled && direct.mediaBaseUrl && direct.jellyfinToken) {
    return {
      key: `direct:${direct.mediaBaseUrl}`,
      url: `${direct.mediaBaseUrl}/Playback/BitrateTest?size=${SIZE_BYTES}`,
      headers: {
        [JELLYFIN_AUTH_HEADER]: client.getAuthHeader(direct.jellyfinToken),
        [JELLYFIN_TOKEN_HEADER]: direct.jellyfinToken,
      },
      withCookies: false,
    };
  }
  const token = client.getAccessToken();
  return {
    key: "proxy",
    url: `${client.getBaseUrl()}/Playback/BitrateTest?size=${SIZE_BYTES}`,
    headers: {
      [JELLYFIN_AUTH_HEADER]: client.getAuthHeader(),
      ...(token ? { [JELLYFIN_TOKEN_HEADER]: token } : {}),
    },
    withCookies: client.useCredentials,
  };
}

/** Lance la mesure en tâche de fond si le cache est froid (fire-and-forget).
 *  Une mesure encore fraîche mais prise sur une AUTRE voie est refaite — et
 *  si une mesure d'une autre voie est en vol (le proxy, mesuré au démarrage,
 *  avant que le direct ne s'ouvre), la nouvelle est enchaînée derrière au lieu
 *  d'être perdue : c'est elle que lira la première lecture. */
export function primeBitrateMeasure(client: JellyfinClient, options: BitrateMeasureOptions = {}): void {
  const route = routeFor(client, options).key;
  if (inFlight) {
    if (inFlightRoute !== route) void inFlight.finally(() => primeBitrateMeasure(client, options));
    return;
  }
  if (cachedBitrate() != null && measuredRoute === route) return;
  void measureBitrate(client, options);
}

/** Télécharge le témoin et chronomètre. Renvoie des bits/s bornés, ou null. */
export function measureBitrate(client: JellyfinClient, options: BitrateMeasureOptions = {}): Promise<number | null> {
  const route = routeFor(client, options);
  const fresh = cachedBitrate();
  if (fresh != null && measuredRoute === route.key) return Promise.resolve(fresh);
  if (inFlight) return inFlight;
  inFlightRoute = route.key;
  inFlight = runMeasure(route).finally(() => { inFlight = null; inFlightRoute = null; });
  return inFlight;
}

async function runMeasure(route: MeasureRoute): Promise<number | null> {
  try {
    const startedAt = Date.now();
    // Timeout par Promise.race, PAS d'AbortController : même arbitrage que
    // fetchWithRetry (un signal casse certains fetch React Native). Le fetch
    // abandonné continue en arrière-plan, son résultat est simplement ignoré.
    const body = await Promise.race([
      download(route.url, route.headers, route.withCookies),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
    ]);
    if (body == null) return null;
    const seconds = (Date.now() - startedAt) / 1000;
    if (seconds <= 0) return null;
    // La taille demandée est CONNUE (N octets) : seul le temps compte — pas
    // besoin de faire confiance à la longueur rapportée par le runtime.
    const bps = Math.round((SIZE_BYTES * 8) / seconds);
    if (bps < MIN_BPS || bps > MAX_BPS) return null;
    measuredBps = bps;
    measuredAt = Date.now();
    measuredRoute = route.key;
    return bps;
  } catch {
    return null;
  }
}

async function download(
  url: string,
  headers: Record<string, string>,
  withCookies: boolean,
): Promise<true | null> {
  const response = await fetch(url, {
    headers,
    credentials: withCookies ? "include" : undefined,
  });
  if (!response.ok) return null;
  // Consommer le corps EN ENTIER — c'est lui qu'on chronomètre. arrayBuffer
  // avec repli text : certains runtimes RN sont capricieux sur l'un des deux.
  await response.arrayBuffer().catch(() => response.text());
  return true;
}
