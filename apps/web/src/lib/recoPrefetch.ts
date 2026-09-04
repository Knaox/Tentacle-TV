import type { QueryClient } from "@tanstack/react-query";
import {
  RECO_PAGE_KEY,
  isDataSaverActive,
  prefetchRecoPage,
  prefetchWatchProviders,
  recoFilterKey,
} from "@tentacle-tv/api-client";
import type { JellyfinClient, RecoPage } from "@tentacle-tv/api-client";
import { recoBackdropUrl, recoPosterUrl } from "@tentacle-tv/api-client";
import { Recommendations } from "../lazyPages";

/**
 * Le préchargement de la page Recommandations : au boot (en temps mort), la
 * page « all » et celle du filtre sauvegardé, l'annuaire des plateformes, le
 * chunk de la page, puis les affiches des premières rangées — pour qu'une
 * arrivée sur la page ne montre ni spinner, ni squelette, ni affiche qui
 * arrive. Idempotent par compte.
 */
export interface RecoPrefetchDeps {
  qc: QueryClient;
  client: JellyfinClient;
  savedFilter: readonly number[];
}

const IDLE_TIMEOUT_MS = 3_000;
const FALLBACK_DELAY_MS = 1_500;
const WARM_ROWS = 2;
const WARM_PER_ROW = 8;

let warmedFor: string | null = null;

interface IdleWindow {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
}

/** Programme le préchargement en temps mort ; rend l'annulation. */
export function scheduleRecoPrefetch(deps: RecoPrefetchDeps, ownerKey: string): () => void {
  if (warmedFor === ownerKey) return () => undefined;
  warmedFor = ownerKey;
  let cancelled = false;
  const run = () => {
    if (!cancelled) void runRecoPrefetch(deps);
  };
  const idle = window as unknown as IdleWindow;
  if (typeof idle.requestIdleCallback === "function") {
    const id = idle.requestIdleCallback(run, { timeout: IDLE_TIMEOUT_MS });
    return () => {
      cancelled = true;
      idle.cancelIdleCallback?.(id);
    };
  }
  const timer = setTimeout(run, FALLBACK_DELAY_MS);
  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}

export async function runRecoPrefetch(deps: RecoPrefetchDeps): Promise<void> {
  const { qc, client, savedFilter } = deps;
  const tasks: Promise<unknown>[] = [
    prefetchRecoPage(qc, null),
    prefetchWatchProviders(qc),
    Recommendations.preload(),
  ];
  if (savedFilter.length > 0) tasks.push(prefetchRecoPage(qc, savedFilter));
  await Promise.allSettled(tasks);
  const page = qc.getQueryData<RecoPage>([RECO_PAGE_KEY, recoFilterKey(savedFilter)]);
  if (page) void warmRecoImages(page, client);
}

/**
 * `new Image()` sur les premières affiches (et le visuel de la première
 * diapositive) — les MÊMES URLs que les cartes et le héros, sinon le cache
 * HTTP est manqué. Rien en mode économie de données. Tenue quand tout est
 * décodé (ou en échec) : l'échange de page s'y cale.
 */
export function warmRecoImages(
  page: RecoPage,
  client: JellyfinClient,
  limits: { rows: number; perRow: number } = { rows: WARM_ROWS, perRow: WARM_PER_ROW }
): Promise<void> {
  if (isDataSaverActive() || typeof Image === "undefined") return Promise.resolve();
  const urls = new Set<string>();
  const hero = page.rows.find((row) => row.key === "forYou")?.items[0];
  if (hero?.backdropPath) {
    const url = recoBackdropUrl(hero, () => "");
    if (url) urls.add(url);
  }
  for (const row of page.rows.slice(0, limits.rows)) {
    for (const item of row.items.slice(0, limits.perRow)) {
      const url = recoPosterUrl(item, (id) => client.getImageUrl(id, "Primary", { height: 450, quality: 90 }));
      if (url) urls.add(url);
    }
  }
  const decoded: Promise<unknown>[] = [];
  for (const url of urls) {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    decoded.push(img.decode().catch(() => undefined));
  }
  return Promise.allSettled(decoded).then(() => undefined);
}

/** Survol ou focus du lien de navigation : chunk + page (no-op si tout est frais). */
export function onRecoNavIntent(qc: QueryClient, savedFilter: readonly number[]): void {
  void Recommendations.preload().catch(() => undefined);
  void prefetchRecoPage(qc, savedFilter).catch(() => undefined);
}
