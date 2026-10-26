/**
 * Octave — les pochettes PRÊTES avant d'être montrées : chargées et DÉCODÉES
 * (`HTMLImageElement.decode()`) pendant que les résultats se préparent, pour
 * qu'une rangée révélée ait déjà son image — jamais une pochette qui apparaît
 * sous les yeux. Une adresse décodée est retenue : `Artwork` l'affiche alors
 * d'emblée, sans fondu.
 *
 * L'attente est BORNÉE : au-delà du budget, les résultats partent quand même
 * (les images en retard arrivent en fondu, sans rien déplacer). Une image qui
 * n'existe pas (404, illisible) est retenue aussi, une minute : sa rangée naît
 * avec son repli dessiné, sans case vide un instant à l'écran.
 *
 * « Décodée » = « déjà montrée » : la MÊME mémoire que le reste de
 * l'application (`lib/seenImages.ts`, règle de D5), jamais une seconde.
 */

import { isImageReady, markImageSeen, resetSeenImagesForTests, wasImageSeen } from "../../../lib/seenImages";

const loading = new Map<string, Promise<void>>();
const failedAt = new Map<string, number>();
/** Un échec retenu une minute : assez pour la révélation qui l'attendait, sans condamner une panne passagère. */
const FAILED_FOR_MS = 60_000;
/** Les échecs retenus au plus (les plus anciens sont oubliés). */
const MAX_REMEMBERED = 600;

export function isArtworkDecoded(src: string): boolean {
  return wasImageSeen(src);
}

/** Déjà montrée, ou déjà dans le cache mémoire du navigateur (sonde synchrone de D5). */
export function isArtworkReady(src: string): boolean {
  return isImageReady(src);
}

export function markArtworkDecoded(src: string): void {
  markImageSeen(src);
}

/** Ce décodage vient-il d'échouer (image absente ou illisible) ? `Artwork` dessine alors son repli d'emblée. */
export function isArtworkFailed(src: string, now = Date.now()): boolean {
  const at = failedAt.get(src);
  return at !== undefined && now - at < FAILED_FOR_MS;
}

function markArtworkFailed(src: string): void {
  failedAt.delete(src);
  failedAt.set(src, Date.now());
  if (failedAt.size > MAX_REMEMBERED) {
    const oldest = failedAt.keys().next().value;
    if (oldest !== undefined) failedAt.delete(oldest);
  }
}

function decodeOne(src: string): Promise<void> {
  if (wasImageSeen(src)) return Promise.resolve();
  const running = loading.get(src);
  if (running) return running;
  const img = new Image();
  img.decoding = "async";
  img.src = src;
  // Une image absente ou illisible ne retient personne : `Artwork` dessinera son repli d'emblée.
  const job = img
    .decode()
    .then(() => markArtworkDecoded(src), () => markArtworkFailed(src))
    .finally(() => loading.delete(src));
  loading.set(src, job);
  return job;
}

/** Charge et décode `srcs` ; résout quand toutes sont prêtes ou que `budgetMs` est écoulé. */
export function preloadArtwork(srcs: readonly string[], budgetMs: number): Promise<void> {
  const wanted = [...new Set(srcs)].filter((s) => !wasImageSeen(s) && !isArtworkFailed(s));
  if (wanted.length === 0) return Promise.resolve();
  const all = Promise.all(wanted.map(decodeOne)).then(() => undefined);
  return Promise.race([all, new Promise<void>((resolve) => setTimeout(resolve, budgetMs))]);
}

/** Pour les tests. */
export function resetArtworkPreloadForTests(): void {
  resetSeenImagesForTests();
  loading.clear();
  failedAt.clear();
}
