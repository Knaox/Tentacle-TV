import type { TitleKey, TitleProvider } from "@tentacle-tv/shared";

/**
 * Le regroupeur des questions qu'on pose à une extension sur des titres.
 * Une page monte vingt cartes d'un coup, et chacune veut savoir quelque chose
 * de SON titre : une requête par carte ferait vingt allers-retours. Les clés
 * demandées dans la même fenêtre (une image, ~16 ms) partent ensemble, par
 * paquets ; chaque carte garde sa promesse — donc son entrée de cache — à
 * elle : un geste fait ne re-rend que sa carte.
 *
 * Partagé par l'état des cartes (`titleStateBatcher`) et les saisons qui
 * manquent aux séries (`titleGapsBatcher`).
 */

export type TitleFetcher = (url: string) => Promise<unknown>;

export interface TitleBatchRoute<T> {
  /** Ce qui sépare deux questions qu'on ne mélange pas : l'extension, sa route, la langue. */
  id: (provider: TitleProvider, lang: string) => string;
  /** `null` : l'extension ne déclare pas la route — chaque clé vaut `missing`. */
  url: (provider: TitleProvider, keys: readonly TitleKey[], lang: string) => string | null;
  read: (raw: unknown, keys: readonly TitleKey[]) => Map<TitleKey, T>;
  /** Ce que vaut une clé dont la réponse ne dit rien. */
  missing: T;
  /** Au plus autant de clés par question (longueur d'URL). */
  batch: number;
}

interface Waiter<T> {
  resolve: (value: T) => void;
  reject: (err: unknown) => void;
}

interface Bucket<T> {
  provider: TitleProvider;
  lang: string;
  fetcher: TitleFetcher;
  waiters: Map<TitleKey, Waiter<T>[]>;
}

const WINDOW_MS = 16;

export function createTitleBatcher<T>(route: TitleBatchRoute<T>) {
  const buckets = new Map<string, Bucket<T>>();

  async function flush(id: string): Promise<void> {
    const bucket = buckets.get(id);
    buckets.delete(id);
    if (!bucket) return;
    const keys = [...bucket.waiters.keys()];
    const settle = (key: TitleKey, done: (w: Waiter<T>) => void) => {
      for (const w of bucket.waiters.get(key) ?? []) done(w);
    };
    for (let i = 0; i < keys.length; i += route.batch) {
      const chunk = keys.slice(i, i + route.batch);
      const url = route.url(bucket.provider, chunk, bucket.lang);
      try {
        const values = url === null ? new Map<TitleKey, T>() : route.read(await bucket.fetcher(url), chunk);
        // Une clé dont l'extension ne dit rien : la valeur « rien ».
        for (const key of chunk) settle(key, (w) => w.resolve(values.has(key) ? (values.get(key) as T) : route.missing));
      } catch (err) {
        for (const key of chunk) settle(key, (w) => w.reject(err));
      }
    }
  }

  /** La réponse pour UNE clé, regroupée avec celles que les autres cartes demandent au même instant. */
  return function load(provider: TitleProvider, key: TitleKey, lang: string, fetcher: TitleFetcher): Promise<T> {
    const id = route.id(provider, lang);
    let bucket = buckets.get(id);
    if (!bucket) {
      bucket = { provider, lang, fetcher, waiters: new Map() };
      buckets.set(id, bucket);
      setTimeout(() => void flush(id), WINDOW_MS);
    }
    const target = bucket;
    return new Promise<T>((resolve, reject) => {
      const list = target.waiters.get(key) ?? [];
      list.push({ resolve, reject });
      target.waiters.set(key, list);
    });
  };
}
