/**
 * Octave — les pochettes PRÊTES avant d'être montrées : chargées et DÉCODÉES
 * (`HTMLImageElement.decode()`) pendant que les résultats se préparent, pour
 * qu'une rangée révélée ait déjà son image — jamais une pochette qui apparaît
 * sous les yeux. Une adresse décodée est retenue : `Artwork` l'affiche alors
 * d'emblée, sans fondu.
 *
 * L'attente est BORNÉE : au-delà du budget, les résultats partent quand même
 * (les images en retard arrivent en fondu, sans rien déplacer).
 */

const decoded = new Set<string>();
const loading = new Map<string, Promise<void>>();
/** Assez pour plusieurs pages de résultats ; au-delà, les plus anciennes sont oubliées (le cache HTTP reste). */
const MAX_REMEMBERED = 600;

export function isArtworkDecoded(src: string): boolean {
  return decoded.has(src);
}

export function markArtworkDecoded(src: string): void {
  decoded.add(src);
  if (decoded.size > MAX_REMEMBERED) {
    const oldest = decoded.values().next().value;
    if (oldest !== undefined) decoded.delete(oldest);
  }
}

function decodeOne(src: string): Promise<void> {
  if (decoded.has(src)) return Promise.resolve();
  const running = loading.get(src);
  if (running) return running;
  const img = new Image();
  img.decoding = "async";
  img.src = src;
  // Une image absente ou illisible ne retient personne : `Artwork` aura son repli.
  const job = img
    .decode()
    .then(() => markArtworkDecoded(src), () => undefined)
    .finally(() => loading.delete(src));
  loading.set(src, job);
  return job;
}

/** Charge et décode `srcs` ; résout quand toutes sont prêtes ou que `budgetMs` est écoulé. */
export function preloadArtwork(srcs: readonly string[], budgetMs: number): Promise<void> {
  const wanted = [...new Set(srcs)].filter((s) => !decoded.has(s));
  if (wanted.length === 0) return Promise.resolve();
  const all = Promise.all(wanted.map(decodeOne)).then(() => undefined);
  return Promise.race([all, new Promise<void>((resolve) => setTimeout(resolve, budgetMs))]);
}

/** Pour les tests. */
export function resetArtworkPreloadForTests(): void {
  decoded.clear();
  loading.clear();
}
