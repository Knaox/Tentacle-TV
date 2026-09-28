import { getLibraryIndexMemo } from "../../reco/candidates/libraryMemo";
import type { LibraryEntry } from "../../reco/candidates/libraryIndex";
import { ANIME_UNIVERSE_KEY } from "../../reco/facets";
import { readPool } from "../../reco/poolStore";
import { listSwipes } from "../../swipe/swipeStore";
import type { WtAffinityKind } from "../protocol";
import { animeLibraryItemIds } from "./affinityAnimeLibraries";
import { collectAnimeKeys, countKinds } from "./affinityKinds";
import { rankCatalog, sharedEntries, type MemberTaste } from "./affinityRanking";
import type { AffinityCard } from "./affinityTypes";

/**
 * Affinité — ce que le serveur sait déjà du goût de chacun, et la pile
 * commune qui en sort. Lecture seule : l'index de bibliothèque partagé avec
 * le moteur de recommandations (mémoïsé, jamais un balayage de plus s'il est
 * chaud), le pool classé, les verdicts d'« Affiner ».
 *
 * Mémorisé deux minutes par compte : le choix du type compte les titres, le
 * lancement qui suit les classe — un seul chargement pour les deux.
 */

/** Au-delà, une soirée n'y suffirait pas. */
export const DECK_MAX = 400;
const TASTE_MEMO_MS = 2 * 60_000;

interface LoadedTaste {
  taste: MemberTaste;
  /** Les titres que son pool marque « animé » (fiches TMDB). */
  poolAnimeKeys: string[];
}

const tasteMemo = new Map<string, { at: number; loaded: LoadedTaste }>();

async function loadTaste(userId: string): Promise<LoadedTaste> {
  const [library, pool, swipes] = await Promise.all([
    getLibraryIndexMemo(userId),
    readPool(userId).catch(() => null),
    listSwipes(userId).catch(() => []),
  ]);
  const ranked = [...(pool?.entries ?? [])].sort((a, b) => b.breakdown.total - a.breakdown.total);
  const last = Math.max(1, ranked.length - 1);
  const poolRank = new Map(ranked.map((e, i) => [e.candidate.key, 1 - i / last] as const));
  const poolAnimeKeys = ranked
    .filter((e) => e.candidate.facets.some((f) => f.key === ANIME_UNIVERSE_KEY))
    .map((e) => e.candidate.key);
  return {
    taste: {
      userId,
      library,
      poolRank,
      swipes: new Map(swipes.map((s) => [`${s.mediaType}:${s.tmdbId}`, s.verdict] as const)),
    },
    poolAnimeKeys,
  };
}

async function loadTasteMemo(userId: string): Promise<LoadedTaste> {
  const now = Date.now();
  for (const [id, hit] of tasteMemo) if (now - hit.at >= TASTE_MEMO_MS) tasteMemo.delete(id);
  const hit = tasteMemo.get(userId);
  if (hit) return hit.loaded;
  const loaded = await loadTaste(userId);
  tasteMemo.set(userId, { at: now, loaded });
  return loaded;
}

export interface GroupCatalog {
  members: MemberTaste[];
  /** Ce que tous les membres peuvent lire (et n'ont pas tous vu). */
  entries: LibraryEntry[];
  animeKeys: Set<string>;
}

/** Le catalogue commun d'une salle. `viewerId` : le compte dont les vues
 *  disent quelles bibliothèques sont des bibliothèques d'animés. */
export async function loadGroupCatalog(userIds: readonly string[], viewerId: string): Promise<GroupCatalog> {
  const [loaded, animeItemIds] = await Promise.all([
    Promise.all(userIds.map(loadTasteMemo)),
    animeLibraryItemIds(viewerId),
  ]);
  const members = loaded.map((l) => l.taste);
  const entries = sharedEntries(members);
  const animeKeys = collectAnimeKeys({ entries, poolAnimeKeys: loaded.flatMap((l) => l.poolAnimeKeys), animeItemIds });
  return { members, entries, animeKeys };
}

export function catalogKindCounts(catalog: GroupCatalog): Record<WtAffinityKind, number> {
  return countKinds(catalog.entries, catalog.animeKeys);
}

export function catalogDeck(catalog: GroupCatalog, kind: WtAffinityKind, seed: string): AffinityCard[] {
  return rankCatalog({ ...catalog, kind, seed, max: DECK_MAX });
}

/** Les titres que ce compte peut lire, pour un membre arrivé après le
 *  lancement (la pile ne connaissait pas sa bibliothèque). */
export async function readableKeys(userId: string): Promise<Set<string>> {
  const library = await getLibraryIndexMemo(userId);
  return new Set(library.byKey.keys());
}

/** Isolation des tests. */
export function resetAffinityCatalogForTests(): void {
  tasteMemo.clear();
}
