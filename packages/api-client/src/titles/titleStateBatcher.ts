import {
  TITLE_STATE_BATCH,
  readTitleStates,
  titleStateUrl,
  type TitleKey,
  type TitleProvider,
  type TitleState,
} from "@tentacle-tv/shared";

/**
 * Une rangée monte vingt cartes hors bibliothèque d'un coup, et chacune veut
 * savoir où en est SON titre. Une requête par carte ferait vingt allers-retours
 * vers le plugin ; ce regroupeur les rassemble : les clés demandées dans la
 * même fenêtre (une image, ~16 ms) partent ensemble, par paquets de
 * `TITLE_STATE_BATCH`. Chaque carte garde son entrée de cache à elle (cf.
 * `useTitleState`) : une demande faite ne re-rend que sa carte.
 */

export type TitleFetcher = (url: string) => Promise<unknown>;

interface Waiter {
  resolve: (state: TitleState | null) => void;
  reject: (err: unknown) => void;
}

interface Bucket {
  provider: TitleProvider;
  lang: string;
  fetcher: TitleFetcher;
  waiters: Map<TitleKey, Waiter[]>;
}

const WINDOW_MS = 16;
const buckets = new Map<string, Bucket>();

async function flush(id: string): Promise<void> {
  const bucket = buckets.get(id);
  buckets.delete(id);
  if (!bucket) return;
  const keys = [...bucket.waiters.keys()];
  for (let i = 0; i < keys.length; i += TITLE_STATE_BATCH) {
    const chunk = keys.slice(i, i + TITLE_STATE_BATCH);
    try {
      const states = readTitleStates(await bucket.fetcher(titleStateUrl(bucket.provider, chunk, bucket.lang)), chunk);
      // Une clé que le plugin ne connaît pas : rien à dire, rien à offrir.
      for (const key of chunk) for (const w of bucket.waiters.get(key) ?? []) w.resolve(states.get(key) ?? null);
    } catch (err) {
      for (const key of chunk) for (const w of bucket.waiters.get(key) ?? []) w.reject(err);
    }
  }
}

/** L'état d'UN titre, regroupé avec ceux que les autres cartes demandent au même instant. */
export function loadTitleState(
  provider: TitleProvider,
  key: TitleKey,
  lang: string,
  fetcher: TitleFetcher,
): Promise<TitleState | null> {
  const id = `${provider.pluginId}|${provider.statePath}|${lang}`;
  let bucket = buckets.get(id);
  if (!bucket) {
    bucket = { provider, lang, fetcher, waiters: new Map() };
    buckets.set(id, bucket);
    setTimeout(() => void flush(id), WINDOW_MS);
  }
  const target = bucket;
  return new Promise((resolve, reject) => {
    const list = target.waiters.get(key) ?? [];
    list.push({ resolve, reject });
    target.waiters.set(key, list);
  });
}
