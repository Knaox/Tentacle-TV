/**
 * La récupération des petits fichiers du snapshot (JSON, affiches, side-cars,
 * planches) sur le mobile : le `fetch` de React Native, borné à 20 s.
 *
 * `X-Emby-Token` et non `Bearer` : ces URL passent par le proxy `/api/jellyfin`,
 * qui transmet l'en-tête tel quel à Jellyfin — un Bearer y ferait un 401 muet.
 * Les routes `/api/downloads/*` du transfert, elles, veulent le Bearer.
 */

import type { FetchBytes } from "@tentacle-tv/offline-core";

/** Au-delà, on considère la source morte. Même valeur que le bureau. */
const TIMEOUT_MS = 20_000;

/** Fabrique un récupérateur lié au jeton de la session. */
export function makeFetcher(token: string): FetchBytes {
  return async (url: string, maxBytes: number): Promise<Uint8Array | null> => {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, { headers: { "X-Emby-Token": token }, signal: abort.signal });
      if (!response.ok) return null;
      const bytes = new Uint8Array(await response.arrayBuffer());
      // Borne APRÈS lecture : ces ressources sont petites par nature, et un
      // corps démesuré signale une erreur de route, pas une grosse affiche.
      return bytes.byteLength > maxBytes ? null : bytes;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };
}
