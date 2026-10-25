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

/** Les hôtes d'images à préconnecter au plus (la poignée TLS d'une première pochette, gratuite d'avance). */
export const PRECONNECT_MAX = 4;

/**
 * Les ORIGINES (https, autres que la page) des pochettes gardées, les plus vues d'abord : tirées des données,
 * jamais d'une liste d'hôtes — le cœur ne sait pas d'où viennent les images.
 */
export function preconnectOrigins(urls: readonly (string | null)[], pageOrigin: string, max = PRECONNECT_MAX): string[] {
  const counts = new Map<string, number>();
  for (const url of urls) {
    if (!url) continue;
    let origin: string;
    try {
      origin = new URL(url).origin;
    } catch {
      continue;
    }
    if (!origin.startsWith("https://") || origin === pageOrigin) continue;
    counts.set(origin, (counts.get(origin) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, max).map(([origin]) => origin);
}

const connected = new Set<string>();

/** Une `<link rel="preconnect">` par origine, une fois par chargement de la page (sans `crossorigin` : celui des `<img>`). */
export function preconnect(origins: readonly string[], doc: Document | undefined = globalThis.document): void {
  if (!doc?.head) return;
  for (const origin of origins) {
    if (connected.has(origin)) continue;
    connected.add(origin);
    const link = doc.createElement("link");
    link.rel = "preconnect";
    link.href = origin;
    doc.head.appendChild(link);
  }
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
