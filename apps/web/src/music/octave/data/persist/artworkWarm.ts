/**
 * Octave — les pochettes des pages gardées les plus récentes, décodées AU
 * REPOS juste après l'ouverture d'Octave : une recherche rouverte montre ses
 * images d'emblée (`isArtworkDecoded`), sans fondu. Elles viennent en général
 * du cache HTTP du navigateur ; rien n'est demandé à l'extension.
 */

import { preloadArtwork } from "../../components/artworkPreload";

/** Assez pour la tête de quelques recherches ; au-delà, l'affichage les charge comme avant. */
export const WARM_ARTWORK_MAX = 24;
const MAX_DEPTH = 5;
const FIELDS = new Set(["artworkUrl", "imageUrl"]);

/** Les adresses d'images d'une donnée gardée, dans l'ordre où l'écran les montre (en largeur d'abord). */
export function artworkUrlsOf(data: unknown, limit: number): string[] {
  const out: string[] = [];
  let level: unknown[] = [data];
  for (let depth = 0; depth < MAX_DEPTH && level.length > 0 && out.length < limit; depth++) {
    const next: unknown[] = [];
    for (const node of level) {
      if (Array.isArray(node)) {
        next.push(...node);
        continue;
      }
      if (!node || typeof node !== "object") continue;
      for (const [k, v] of Object.entries(node)) {
        if (FIELDS.has(k) && typeof v === "string" && v) {
          if (!out.includes(v)) out.push(v);
          if (out.length >= limit) return out;
        } else if (v && typeof v === "object") next.push(v);
      }
    }
    level = next;
  }
  return out;
}

/** Les pochettes à décoder : quelques-unes par page, des plus récentes d'abord. */
export function warmArtworkList(recent: readonly unknown[], max = WARM_ARTWORK_MAX, perEntry = 6): string[] {
  const out: string[] = [];
  for (const data of recent) {
    for (const url of artworkUrlsOf(data, perEntry)) {
      if (!out.includes(url)) out.push(url);
      if (out.length >= max) return out;
    }
  }
  return out;
}

type IdleScheduler = (run: () => void) => void;

const onIdle: IdleScheduler = (run) => {
  const ric = (globalThis as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
  if (ric) ric(run, { timeout: 3_000 });
  else setTimeout(run, 500);
};

/** Décode au repos, sans rien retenir : une image absente n'arrête rien (`preloadArtwork`). */
export function warmArtworkWhenIdle(urls: readonly (string | null)[], schedule: IdleScheduler = onIdle): void {
  const srcs = urls.filter((u): u is string => !!u);
  if (srcs.length === 0) return;
  schedule(() => void preloadArtwork(srcs, 15_000));
}
