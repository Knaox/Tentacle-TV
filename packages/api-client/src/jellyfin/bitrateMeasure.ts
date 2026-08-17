import { JELLYFIN_AUTH_HEADER, JELLYFIN_TOKEN_HEADER } from "@tentacle-tv/shared";
import type { JellyfinClient } from "../jellyfin";

/**
 * Mesure du débit RÉEL de la connexion via le téléchargement témoin Jellyfin
 * `GET /Playback/BitrateTest?size=N` (N octets aléatoires, servis à travers le
 * proxy Tentacle — entrée de liste blanche dédiée côté backend).
 *
 * Usage : les clients TV appellent `amorcerMesureDebit(client)` tôt (montage de
 * l'accueil / du lecteur), puis lisent `debitEnCache()` au moment de choisir la
 * qualité. La mesure est UNE photographie, pas un tuner permanent : cache de
 * 10 min, single-flight, et tout échec (proxy sans l'entrée, timeout, réseau)
 * rend `null` — l'appelant n'applique alors AUCUN cap (dégradation gracieuse,
 * indispensable face à un serveur pas encore à jour).
 */

const TAILLE_OCTETS = 3_000_000;
const TIMEOUT_MS = 8_000;
const CACHE_MS = 10 * 60_000;
// Bornes de vraisemblance : en dessous, la mesure dit surtout que le réseau
// était en panne ; au-dessus, que le corps était déjà dans un cache local.
const MIN_BPS = 100_000;
const MAX_BPS = 1_000_000_000;

let mesureBps: number | null = null;
let mesureeA = 0;
let enVol: Promise<number | null> | null = null;

/** Dernière mesure (bits/s) si elle a moins de 10 min, sinon null. */
export function debitEnCache(): number | null {
  if (mesureBps == null) return null;
  return Date.now() - mesureeA <= CACHE_MS ? mesureBps : null;
}

/** Lance la mesure en tâche de fond si le cache est froid (fire-and-forget). */
export function amorcerMesureDebit(client: JellyfinClient): void {
  if (debitEnCache() != null || enVol) return;
  void mesurerDebit(client);
}

/** Télécharge le témoin et chronomètre. Renvoie des bits/s bornés, ou null. */
export function mesurerDebit(client: JellyfinClient): Promise<number | null> {
  const frais = debitEnCache();
  if (frais != null) return Promise.resolve(frais);
  if (enVol) return enVol;
  enVol = executerMesure(client).finally(() => { enVol = null; });
  return enVol;
}

async function executerMesure(client: JellyfinClient): Promise<number | null> {
  const url = `${client.getBaseUrl()}/Playback/BitrateTest?size=${TAILLE_OCTETS}`;
  const token = client.getAccessToken();
  const headers: Record<string, string> = {
    [JELLYFIN_AUTH_HEADER]: client.getAuthHeader(),
    ...(token ? { [JELLYFIN_TOKEN_HEADER]: token } : {}),
  };
  try {
    const debut = Date.now();
    // Timeout par Promise.race, PAS d'AbortController : même arbitrage que
    // fetchWithRetry (un signal casse certains fetch React Native). Le fetch
    // abandonné continue en arrière-plan, son résultat est simplement ignoré.
    const corps = await Promise.race([
      telecharger(url, headers, client.useCredentials),
      new Promise<null>((resoudre) => setTimeout(() => resoudre(null), TIMEOUT_MS)),
    ]);
    if (corps == null) return null;
    const secondes = (Date.now() - debut) / 1000;
    if (secondes <= 0) return null;
    // La taille demandée est CONNUE (N octets) : seul le temps compte — pas
    // besoin de faire confiance à la longueur rapportée par le runtime.
    const bps = Math.round((TAILLE_OCTETS * 8) / secondes);
    if (bps < MIN_BPS || bps > MAX_BPS) return null;
    mesureBps = bps;
    mesureeA = Date.now();
    return bps;
  } catch {
    return null;
  }
}

async function telecharger(
  url: string,
  headers: Record<string, string>,
  avecCookies: boolean,
): Promise<true | null> {
  const reponse = await fetch(url, {
    headers,
    credentials: avecCookies ? "include" : undefined,
  });
  if (!reponse.ok) return null;
  // Consommer le corps EN ENTIER — c'est lui qu'on chronomètre. arrayBuffer
  // avec repli text : certains runtimes RN sont capricieux sur l'un des deux.
  await reponse.arrayBuffer().catch(() => reponse.text());
  return true;
}
