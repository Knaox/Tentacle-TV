import { JELLYFIN_AUTH_HEADER, JELLYFIN_TOKEN_HEADER } from "@tentacle-tv/shared";
import { directJellyfinHeaders } from "./directAuth";
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
 * indispensable face à un serveur pas encore à jour). Seule exception, le
 * chemin tamponné : un témoin hors délai après des sondes réussies vaut une
 * borne haute (cf. `runBufferedMeasure`).
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
  /**
   * Le `fetch` du runtime ne rend la réponse qu'une fois le corps ENTIER reçu
   * — React Native. Mesuré au simulateur Apple TV (2026-10-02) : 4,9 s pour
   * 3 Mo bridés à 5 Mb/s, puis 0,2 s de conversion du corps ; chronométrée
   * « à l'arrivée des en-têtes », la mesure ne voyait que la conversion —
   * « 115 Mb/s » sur n'importe quel réseau, et sur un appareil lent un chiffre
   * bas sans rapport avec lui. Le temps se compte alors de la requête à la
   * réponse, moins la latence de deux petites requêtes ; jamais la conversion.
   * OPT-IN : la TV seulement (le mobile a sa tâche ; un navigateur lit le
   * corps en flux et garde la mesure d'origine).
   */
  bufferedFetch?: boolean;
}

interface MeasureRoute {
  /** Clé de cache : une mesure de la voie proxy ne vaut pas pour la voie directe. */
  key: string;
  /** Le témoin, sans sa taille (`?size=N`). */
  base: string;
  headers: Record<string, string>;
  withCookies: boolean;
}

const urlOf = (route: MeasureRoute, size: number) => `${route.base}?size=${size}`;

let measuredBps: number | null = null;
let measuredAt = 0;
let measuredRoute: string | null = null;
let inFlight: Promise<number | null> | null = null;
let inFlightRoute: string | null = null;

/**
 * Dernière mesure (bits/s) si elle a moins de 10 min, sinon null. Avec le
 * client et ses options, seulement si elle a été prise sur la voie qu'il
 * emprunte MAINTENANT : une mesure du direct ne dit rien d'une lecture
 * repassée par le proxy (hors du réseau local, direct coupé). Aucun plafond
 * le temps de remesurer vaut mieux qu'un plafond venu d'un autre lien.
 */
export function cachedBitrate(client?: JellyfinClient, options: BitrateMeasureOptions = {}): number | null {
  if (measuredBps == null) return null;
  if (client && routeKey(openDirect(client, options)) !== measuredRoute) return null;
  return Date.now() - measuredAt <= CACHE_MS ? measuredBps : null;
}

/** La voie directe, si elle est demandée et ouverte. */
function openDirect(client: JellyfinClient, options: BitrateMeasureOptions) {
  const direct = options.preferDirect ? client.getDirectStreaming?.() : null;
  return direct?.enabled && direct.mediaBaseUrl && direct.jellyfinToken ? direct : null;
}

const routeKey = (direct: { mediaBaseUrl: string } | null) => (direct ? `direct:${direct.mediaBaseUrl}` : "proxy");

/** La voie à mesurer : directe si demandée et disponible, sinon le proxy. */
function routeFor(client: JellyfinClient, options: BitrateMeasureOptions): MeasureRoute {
  const direct = openDirect(client, options);
  if (direct) {
    return {
      key: routeKey(direct),
      base: `${direct.mediaBaseUrl}/Playback/BitrateTest`,
      headers: directJellyfinHeaders(client.getAuthHeader(direct.jellyfinToken)),
      withCookies: false,
    };
  }
  const token = client.getAccessToken();
  return {
    key: "proxy",
    base: `${client.getBaseUrl()}/Playback/BitrateTest`,
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
  const run = options.bufferedFetch ? runBufferedMeasure(route) : runMeasure(route);
  inFlight = run.finally(() => { inFlight = null; inFlightRoute = null; });
  return inFlight;
}

function remember(route: MeasureRoute, bps: number): number {
  measuredBps = bps;
  measuredAt = Date.now();
  measuredRoute = route.key;
  return bps;
}

/** Des bits/s bornés, ou null (durée nulle, valeur invraisemblable). */
function boundedBps(bytes: number, seconds: number): number | null {
  if (!(seconds > 0)) return null;
  const bps = Math.round((bytes * 8) / seconds);
  return bps < MIN_BPS || bps > MAX_BPS ? null : bps;
}

async function runMeasure(route: MeasureRoute): Promise<number | null> {
  // Deux passes, la meilleure retenue. La première paie ce qu'aucun segment
  // de lecture ne paiera : connexion à ouvrir, montée en régime TCP, et à
  // l'accueil la concurrence de toutes les affiches qui arrivent. Seule, elle
  // bridait à tort : un réseau large mesuré à travers le proxy passait sous
  // le débit d'un remux 4K. La seconde part sur une connexion déjà chaude.
  const first = await timeOnePass(route);
  if (first == null) return null;
  const second = await timeOnePass(route);
  return remember(route, Math.max(first, second ?? 0));
}

/** La petite requête qui ne mesure que la latence (aller-retour, serveur, proxy). */
const LATENCY_PROBE_BYTES = 1_000;

/** La réponse n'est pas arrivée dans le délai — ce n'est pas un échec du serveur. */
const TIMED_OUT = "timed-out";
type WholeResponse = number | typeof TIMED_OUT | null;

const seconds = (r: WholeResponse): number | null => (typeof r === "number" ? r : null);

/**
 * Sous un `fetch` qui attend le corps entier (`bufferedFetch`) : la latence
 * d'abord — deux petites requêtes, la meilleure (la première ouvre la
 * connexion) —, puis le témoin, deux passes, la meilleure ; le débit, c'est
 * le témoin moins la latence.
 *
 * Un témoin qui dépasse le délai alors que les DEUX sondes ont répondu dit
 * quand même quelque chose : le lien porte moins que 3 Mo en 8 s, ~3 Mb/s.
 * Cette borne haute est retenue comme mesure, sans seconde passe — sinon la
 * connexion la plus lente, celle qui a le plus besoin du plafond, n'en
 * aurait aucun. Le palier qui en découle est celui d'une mesure exacte : tout
 * ce qui passe sous 5,6 Mb/s tombe déjà au plus bas. Une sonde muette, elle,
 * ne dit rien du débit : pas de mesure.
 */
async function runBufferedMeasure(route: MeasureRoute): Promise<number | null> {
  const firstProbe = seconds(await wholeResponseSeconds(route, LATENCY_PROBE_BYTES));
  if (firstProbe == null) return null;
  const secondProbe = seconds(await wholeResponseSeconds(route, LATENCY_PROBE_BYTES));
  const latency = Math.min(firstProbe, secondProbe ?? firstProbe);
  const first = await wholeResponseSeconds(route, SIZE_BYTES);
  if (first === TIMED_OUT) {
    const ceiling = secondProbe == null ? null : boundedBps(SIZE_BYTES, TIMEOUT_MS / 1000 - latency);
    return ceiling == null ? null : remember(route, ceiling);
  }
  if (first == null) return null;
  const total = Math.min(first, seconds(await wholeResponseSeconds(route, SIZE_BYTES)) ?? first);
  const bps = boundedBps(SIZE_BYTES, total - latency);
  return bps == null ? null : remember(route, bps);
}

/** La durée de la requête à la réponse ENTIÈRE, en secondes ; `TIMED_OUT` au
 *  délai dépassé, null en échec. Le corps est déjà là : on ne le lit pas — sa
 *  conversion faussait l'ancienne mesure. */
async function wholeResponseSeconds(route: MeasureRoute, size: number): Promise<WholeResponse> {
  try {
    return await Promise.race([
      (async () => {
        const startedAt = Date.now();
        const response = await fetch(urlOf(route, size), {
          headers: route.headers,
          credentials: route.withCookies ? "include" : undefined,
        });
        return response.ok ? (Date.now() - startedAt) / 1000 : null;
      })(),
      new Promise<typeof TIMED_OUT>((resolve) => setTimeout(() => resolve(TIMED_OUT), TIMEOUT_MS)),
    ]);
  } catch {
    return null;
  }
}

/** Une passe : bits/s bornés, ou null (échec, délai, valeur invraisemblable). */
async function timeOnePass(route: MeasureRoute): Promise<number | null> {
  try {
    // Timeout par Promise.race, PAS d'AbortController : même arbitrage que
    // fetchWithRetry (un signal casse certains fetch React Native). Le fetch
    // abandonné continue en arrière-plan, son résultat est simplement ignoré.
    const seconds = await Promise.race([
      download(urlOf(route, SIZE_BYTES), route.headers, route.withCookies),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
    ]);
    // La taille demandée est CONNUE (N octets) : seul le temps compte — pas
    // besoin de faire confiance à la longueur rapportée par le runtime.
    return seconds == null ? null : boundedBps(SIZE_BYTES, seconds);
  } catch {
    return null;
  }
}

/** Télécharge le témoin ; renvoie la durée du CORPS en secondes, ou null.
 *  Le chronomètre part à l'arrivée des en-têtes : l'aller-retour de la
 *  requête — et, derrière le proxy, le trajet jusqu'à Jellyfin — n'est pas
 *  du débit. Le compter faisait passer une latence pour un réseau étroit. */
async function download(
  url: string,
  headers: Record<string, string>,
  withCookies: boolean,
): Promise<number | null> {
  const response = await fetch(url, {
    headers,
    credentials: withCookies ? "include" : undefined,
  });
  if (!response.ok) return null;
  const startedAt = Date.now();
  // Consommer le corps EN ENTIER — c'est lui qu'on chronomètre. arrayBuffer
  // avec repli text : certains runtimes RN sont capricieux sur l'un des deux.
  await response.arrayBuffer().catch(() => response.text());
  return (Date.now() - startedAt) / 1000;
}
