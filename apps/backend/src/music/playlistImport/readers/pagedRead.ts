/**
 * Octave — la lecture PAGINÉE d'une source, derrière un fournisseur de pages INTERCHANGEABLE (lot « pg », 10/11) :
 * une source n'est que « donne-moi `limit` éléments à partir de `offset` » ; le choix de l'API (publique, clés
 * officielles…) ne touche rien d'autre. Dès que le total est connu, les pages qui manquent partent EN PARALLÈLE
 * BORNÉ (`parallel` en vol), sous un plafond de débit (`rate` : tant de requêtes par fenêtre) — jamais en série page
 * après page, jamais au-delà de ce que la source admet. Total inconnu : page après page jusqu'à une page courte.
 */

export interface SourcePage<T> {
  items: T[];
  /** Le nombre d'éléments que la source annonce, s'il est dit. */
  total: number | null;
}

export interface PageSource<T> {
  /** Une page ; lève pour tout refus (le lecteur dit lequel). */
  page: (offset: number, limit: number) => Promise<SourcePage<T>>;
  pageSize: number;
  /** Pages en vol au plus. */
  parallel: number;
  /** Plafond de débit de la source (Deezer : 50 requêtes par 5 s). */
  rate?: { requests: number; windowMs: number };
  /** Horloge et attente (tests : simulées). */
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export interface PagedResult<T> {
  items: T[];
  /** Le total annoncé (sinon : ce qui a été lu). */
  total: number;
  /** La source en annonce plus que `max` : la lecture s'est arrêtée au garde-fou. */
  truncated: boolean;
  /** Requêtes faites (mesure). */
  requests: number;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Un plafond de débit glissant : `take()` attend qu'une requête de plus tienne dans la fenêtre. */
function rateGate(rate: PageSource<unknown>["rate"], now: () => number, sleep: (ms: number) => Promise<void>) {
  const starts: number[] = [];
  let chain: Promise<void> = Promise.resolve();
  const take = async (): Promise<void> => {
    if (!rate) return;
    for (;;) {
      const t = now();
      while (starts.length > 0 && t - starts[0]! >= rate.windowMs) starts.shift();
      if (starts.length < rate.requests) {
        starts.push(t);
        return;
      }
      await sleep(starts[0]! + rate.windowMs - t);
    }
  };
  // Les prises passent une à une : deux pages ne lisent jamais la même place libre.
  return (): Promise<void> => (chain = chain.then(take));
}

/**
 * Tout ce que la source annonce, à partir de `start` (les `start` premiers sont déjà lus : `known`), au plus `max`
 * éléments en tout. `known.total` : le total déjà annoncé (une tête de playlist le dit), sinon la première page le dira.
 */
export async function readAllPages<T>(source: PageSource<T>, max: number, known: { start: number; total: number | null } = { start: 0, total: null }): Promise<PagedResult<T>> {
  const now = source.now ?? Date.now;
  const gate = rateGate(source.rate, now, source.sleep ?? defaultSleep);
  const size = Math.max(1, source.pageSize);
  let requests = 0;
  const fetchPage = async (offset: number): Promise<SourcePage<T>> => {
    await gate();
    requests += 1;
    return source.page(offset, Math.min(size, max - offset));
  };
  let total = known.total;
  const pages = new Map<number, T[]>();
  let cursor = known.start;
  if (total === null && cursor < max) {
    const first = await fetchPage(cursor);
    pages.set(cursor, first.items);
    total = first.total;
    cursor += size;
    // Total inconnu : page après page, jusqu'à une page courte.
    if (total === null) {
      let last = first.items.length;
      while (last >= size && cursor < max) {
        const next = await fetchPage(cursor);
        pages.set(cursor, next.items);
        last = next.items.length;
        cursor += size;
      }
      const items = [...pages.keys()].sort((a, b) => a - b).flatMap((k) => pages.get(k)!);
      return { items, total: known.start + items.length, truncated: last >= size && cursor >= max, requests };
    }
  }
  const end = Math.min(total ?? 0, max);
  const offsets: number[] = [];
  for (let at = cursor; at < end; at += size) offsets.push(at);
  let next = 0;
  let failed = false;
  const worker = async (): Promise<void> => {
    while (!failed && next < offsets.length) {
      const offset = offsets[next++]!;
      try {
        pages.set(offset, (await fetchPage(offset)).items);
      } catch (error) {
        // Une page refusée arrête les autres : rien ne part plus vers la source.
        failed = true;
        throw error;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, source.parallel), offsets.length) }, worker));
  const items = [...pages.keys()].sort((a, b) => a - b).flatMap((k) => pages.get(k)!);
  return { items, total: total ?? items.length, truncated: (total ?? 0) > max, requests };
}
