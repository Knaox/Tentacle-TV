/**
 * L'implémentation réseau réelle du snapshot.
 *
 * # Pourquoi `net.fetch` et non le `fetch` de Node
 *
 * `net.fetch` passe par la pile réseau de Chromium : mêmes certificats, même
 * proxy système, même résolution que la page elle-même. Le téléchargement
 * réussit donc exactement là où l'application réussit — c'est la parité qui
 * compte, et c'est ce que faisait `ureq` côté Rust en pratique.
 *
 * # Pourquoi `X-Emby-Token` et pas `Bearer`
 *
 * Ces URL passent par le proxy `/api/jellyfin`, qui transmet l'en-tête tel quel
 * à Jellyfin. Jellyfin ne comprend PAS `Authorization: Bearer` et répond 401
 * sans rien dire — c'est ce qui laissait les snapshots JSON vides. Les routes
 * `/api/downloads/*` du backend Tentacle, elles, veulent bien un Bearer : c'est
 * `transfer.ts` qui les appelle, et lui seul.
 */

import { net } from "electron";
import type { FetchBytes } from "./fetcher";

/** Au-delà, on considère la source morte. Même valeur que l'agent `ureq`. */
const TIMEOUT_MS = 20_000;

/** Fabrique un récupérateur lié au serveur et au jeton de la session. */
export function makeFetcher(token: string): FetchBytes {
  return async (url: string, maxBytes: number): Promise<Uint8Array | null> => {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
    try {
      const response = await net.fetch(url, {
        headers: { "X-Emby-Token": token },
        signal: abort.signal,
      });
      if (!response.ok) return null;
      const bytes = new Uint8Array(await response.arrayBuffer());
      // Borne APRÈS lecture : `net.fetch` ne sait pas s'arrêter en cours de
      // route, et ces ressources sont petites par nature. Un corps démesuré
      // signale une erreur de route, pas une grosse affiche.
      return bytes.byteLength > maxBytes ? null : bytes;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };
}
