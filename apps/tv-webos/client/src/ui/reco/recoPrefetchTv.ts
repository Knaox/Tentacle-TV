import type { QueryClient } from "@tanstack/react-query";
import {
  RECO_PAGE_KEY, isDataSaverActive, prefetchRecoPage, recoFilterKey,
  type JellyfinClient, type RecoPage,
} from "@tentacle-tv/api-client";
import { tvRecoHero, tvRecoShelves } from "@tentacle-tv/tv-core";
import { Recommendations } from "@/lazyPages";
import { recoLibraryItems } from "./recoMediaItem";

/**
 * Le préchargement de « Pour vous », version téléviseur — substitué à
 * `lib/recoPrefetch.ts`, qu'appelle `RecoPrefetchBoot` en temps mort.
 *
 * Celui du web préchauffe la page « toutes plateformes », l'annuaire des
 * plateformes et les affiches TMDB des titres hors bibliothèque : tout ce que
 * le téléviseur ne montre pas, et une requête vers un service extérieur pour
 * des titres qu'il écarte. Ici : la page du filtre du compte, le fragment de la
 * page, et les affiches des premières étagères de la BIBLIOTHÈQUE — aux URL
 * mêmes que les cartes demanderont, sans quoi le cache serait manqué. Arriver
 * sur la page ne montre ainsi ni attente ni affiche qui arrive.
 */

export interface RecoPrefetchDeps {
  qc: QueryClient;
  client: JellyfinClient;
  savedFilter: readonly number[];
}

const IDLE_TIMEOUT_MS = 3_000;
const FALLBACK_DELAY_MS = 1_500;
const WARM_SHELVES = 2;
const WARM_PER_SHELF = 8;

let warmedFor: string | null = null;

interface IdleWindow {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (identifier: number) => void;
}

/** Programme le préchargement en temps mort, une fois par compte ; rend l'annulation. */
export function scheduleRecoPrefetch(deps: RecoPrefetchDeps, ownerKey: string): () => void {
  if (warmedFor === ownerKey) return () => undefined;
  warmedFor = ownerKey;
  let cancelled = false;
  const run = () => {
    if (!cancelled) void runRecoPrefetch(deps);
  };
  const idle = window as unknown as IdleWindow;
  if (typeof idle.requestIdleCallback === "function") {
    const identifier = idle.requestIdleCallback(run, { timeout: IDLE_TIMEOUT_MS });
    return () => {
      cancelled = true;
      idle.cancelIdleCallback?.(identifier);
    };
  }
  const timer = setTimeout(run, FALLBACK_DELAY_MS);
  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}

export async function runRecoPrefetch({ qc, client, savedFilter }: RecoPrefetchDeps): Promise<void> {
  await Promise.allSettled([prefetchRecoPage(qc, savedFilter), Recommendations.preload()]);
  const page = qc.getQueryData<RecoPage>([RECO_PAGE_KEY, recoFilterKey(savedFilter)]);
  if (page) warmShelves(page, client);
}

/** `new Image()` sur les premières affiches des étagères — rien en mode économie. */
function warmShelves(page: RecoPage, client: JellyfinClient): void {
  if (isDataSaverActive() || typeof Image === "undefined") return;
  const shelves = tvRecoShelves(page, { hero: tvRecoHero(page) }).slice(0, WARM_SHELVES);
  for (const shelf of shelves) {
    for (const item of recoLibraryItems(shelf.items).slice(0, WARM_PER_SHELF)) {
      const image = new Image();
      image.decoding = "async";
      image.src = client.getImageUrl(item.Id, "Primary", { height: 450, quality: 90 });
    }
  }
}
