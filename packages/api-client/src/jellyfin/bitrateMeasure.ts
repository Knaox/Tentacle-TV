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
 */

const SIZE_BYTES = 3_000_000;
const TIMEOUT_MS = 8_000;
const CACHE_MS = 10 * 60_000;
// Bornes de vraisemblance : en dessous, la mesure dit surtout que le réseau
// était en panne ; au-dessus, que le corps était déjà dans un cache local.
const MIN_BPS = 100_000;
const MAX_BPS = 1_000_000_000;

let measuredBps: number | null = null;
let measuredAt = 0;
let inFlight: Promise<number | null> | null = null;

/** Dernière mesure (bits/s) si elle a moins de 10 min, sinon null. */
export function cachedBitrate(): number | null {
  if (measuredBps == null) return null;
  return Date.now() - measuredAt <= CACHE_MS ? measuredBps : null;
}

/** Lance la mesure en tâche de fond si le cache est froid (fire-and-forget). */
export function primeBitrateMeasure(client: JellyfinClient): void {
  if (cachedBitrate() != null || inFlight) return;
  void measureBitrate(client);
}

/** Télécharge le témoin et chronomètre. Renvoie des bits/s bornés, ou null. */
export function measureBitrate(client: JellyfinClient): Promise<number | null> {
  const fresh = cachedBitrate();
  if (fresh != null) return Promise.resolve(fresh);
  if (inFlight) return inFlight;
  inFlight = runMeasure(client).finally(() => { inFlight = null; });
  return inFlight;
}

async function runMeasure(client: JellyfinClient): Promise<number | null> {
  const url = `${client.getBaseUrl()}/Playback/BitrateTest?size=${SIZE_BYTES}`;
  const token = client.getAccessToken();
  const headers: Record<string, string> = {
    [JELLYFIN_AUTH_HEADER]: client.getAuthHeader(),
    ...(token ? { [JELLYFIN_TOKEN_HEADER]: token } : {}),
  };
  try {
    const startedAt = Date.now();
    // Timeout par Promise.race, PAS d'AbortController : même arbitrage que
    // fetchWithRetry (un signal casse certains fetch React Native). Le fetch
    // abandonné continue en arrière-plan, son résultat est simplement ignoré.
    const body = await Promise.race([
      download(url, headers, client.useCredentials),
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
