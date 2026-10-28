/**
 * Octave — les albums hors bibliothèque VUS DÉFILER, préparés d'avance (règle PURE, `albumWarmup.test.ts`) :
 * à l'ARRÊT du défilement seulement (`WARM_SETTLE_MS` sans mouvement : jamais pendant une rafale), les albums
 * visibles que la vue n'a pas déjà sont signalés à l'extension, qui les prépare sous SON budget de fond — une
 * ouverture ensuite sort de son cache.
 *
 * Deux régimes, choisis par ce que l'extension déclare (jamais par son identifiant) :
 * - `signal` : le point `prefetch` sait préparer des albums (intention `albums`) — un seul envoi par arrêt,
 *   `WARM_SIGNAL_MAX` albums au plus, un album au plus une fois par `WARM_DEDUP_MS` ;
 * - `fetch` (repli : l'extension ne le sait pas) : la vue de l'album est demandée comme au clic, ce qui coûte
 *   des requêtes YouTube au budget COMMUN de l'hôte (20 par minute) — donc `WARM_FETCH_PER_STOP` album par
 *   arrêt et `WARM_FETCH_PER_MINUTE` par minute, pas un de plus.
 * Un album déjà en cache, de la bibliothèque, grisé (`unavailable`) ou d'une autre extension n'est jamais signalé.
 */

import type { MusicAlbum } from "../../music/musicTypes";

export const WARM_SETTLE_MS = 250;
export const WARM_SIGNAL_MAX = 12;
export const WARM_DEDUP_MS = 10 * 60_000;
export const WARM_FETCH_PER_STOP = 1;
export const WARM_FETCH_PER_MINUTE = 4;

export type WarmMode = "signal" | "fetch";

export interface WarmCandidate {
  /** La clé de la vue (`ext:<pluginId>:<id>`, celle d'`entityTarget`). */
  key: string;
  /** L'identifiant opaque de l'album chez l'extension. */
  id: string;
}

/** Les albums d'une liste qu'on peut préparer : hors bibliothèque, de CETTE extension, lisibles ; sans doublon, dans l'ordre. */
export function warmCandidates(albums: readonly Pick<MusicAlbum, "jellyfinId" | "external" | "unavailable">[], pluginId: string): WarmCandidate[] {
  const seen = new Set<string>();
  const out: WarmCandidate[] = [];
  for (const album of albums) {
    const ext = album.external;
    if (album.jellyfinId || !ext || ext.pluginId !== pluginId || album.unavailable != null) continue;
    const key = `ext:${ext.pluginId}:${ext.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ key, id: ext.id });
  }
  return out;
}

/** La mémoire d'un appareil : quels albums sont déjà partis, et quand (fenêtre glissante du repli). */
export interface WarmBook {
  sent: Map<string, number>;
  fetches: number[];
}

export function createWarmBook(): WarmBook {
  return { sent: new Map(), fetches: [] };
}

/**
 * Les albums à préparer à CET arrêt, et la mémoire tenue à jour. `cached(key)` : la vue de cet album est déjà là
 * (rien à demander).
 */
export function pickAlbumsToWarm(book: WarmBook, candidates: readonly WarmCandidate[], mode: WarmMode, now: number, cached: (key: string) => boolean): WarmCandidate[] {
  for (const [key, at] of book.sent) if (now - at >= WARM_DEDUP_MS) book.sent.delete(key);
  while (book.fetches.length > 0 && now - book.fetches[0]! >= 60_000) book.fetches.shift();
  const fresh = candidates.filter((c) => !book.sent.has(c.key) && !cached(c.key));
  const room = mode === "signal" ? WARM_SIGNAL_MAX : Math.min(WARM_FETCH_PER_STOP, WARM_FETCH_PER_MINUTE - book.fetches.length);
  const picked = fresh.slice(0, Math.max(0, room));
  for (const c of picked) {
    book.sent.set(c.key, now);
    if (mode === "fetch") book.fetches.push(now);
  }
  // Borne de la mémoire : les plus anciens partent d'abord (Map garde l'ordre d'insertion).
  while (book.sent.size > 2_000) {
    const oldest = book.sent.keys().next().value;
    if (oldest === undefined) break;
    book.sent.delete(oldest);
  }
  return picked;
}
