/**
 * Octave (mobile) — l'EXÉCUTION d'une requête déléguée (capacité `plugins.clientFetch`) : l'extension musique
 * décrit une requête, le téléphone l'envoie depuis SA connexion — le serveur ne paie rien pour ce compte et
 * l'adresse du serveur n'est pas bloquée par cent comptes qui écoutent. Même règle que le principal du bureau
 * (`apps/desktop-electron/src/main/clientFetch/clientFetchRunner.ts`), dans les limites de `fetch` :
 *
 * - jugée ICI une seconde fois contre le manifeste lu par l'app elle-même (`mobileManifests.ts`) ;
 * - sans cookie (`credentials: "omit"`), sans aucun en-tête de Tentacle : seulement ceux que l'extension décrit ;
 * - délai unique sur tout le trajet ; corps refusé au-delà de `maxBytes` ;
 * - `fetch` suit seul les redirections : l'adresse FINALE est revalidée (hors des hôtes déclarés → `refused`,
 *   rien n'est rendu). Le bureau, lui, les refuse avant de les suivre — InnerTube n'en fait pas.
 */

import {
  allowedUrl,
  checkClientFetchRequest,
  CLIENT_FETCH_LIMITS,
  type ClientFetchManifest,
  type ClientFetchOutcome,
  type ClientFetchRequest,
} from "@tentacle-tv/shared/pluginClientFetch";

export type MobileFetcher = (url: string, init: RequestInit) => Promise<Response>;

const REFUSED: ClientFetchOutcome = { ok: false, reason: "refused" };

/** Taille en octets UTF-8, comptée seulement quand elle peut dépasser (une recherche fait quelques centaines de Ko). */
function tooLarge(body: string, maxBytes: number): boolean {
  if (body.length > maxBytes) return true;
  if (body.length * 3 <= maxBytes) return false;
  return new TextEncoder().encode(body).length > maxBytes;
}

export async function runMobileClientFetch(
  request: ClientFetchRequest,
  manifest: ClientFetchManifest,
  fetcher: MobileFetcher = (url, init) => fetch(url, init),
): Promise<ClientFetchOutcome> {
  if (checkClientFetchRequest(request, manifest) !== null) return REFUSED;
  const timeoutMs = request.timeoutMs ?? CLIENT_FETCH_LIMITS.defaultTimeoutMs;
  const maxBytes = request.maxBytes ?? CLIENT_FETCH_LIMITS.defaultMaxBytes;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetcher(request.url, {
      method: request.method,
      headers: request.headers ?? {},
      ...(request.body !== undefined ? { body: request.body } : {}),
      credentials: "omit",
      cache: "no-store",
      signal: controller.signal,
    });
    const finalUrl = res.url || request.url;
    if (!allowedUrl(finalUrl, manifest.hosts)) return REFUSED;
    const body = await res.text();
    if (tooLarge(body, maxBytes)) return { ok: false, reason: "tooLarge" };
    const contentType = res.headers.get("content-type");
    return { ok: true, response: { status: res.status, url: finalUrl, headers: contentType ? { "content-type": contentType } : {}, body } };
  } catch {
    return { ok: false, reason: controller.signal.aborted ? "timeout" : "network" };
  } finally {
    clearTimeout(timer);
  }
}
