import { tmdbConfigured } from "../tmdb/client";
import { getCachedMetaMany, getTitleMeta, metaKey } from "../tmdb/metaCache";
import type { TitleMeta } from "../tmdb/metaCache";
import { facetsFromTmdb } from "./facets";
import type { LibraryIndex } from "./candidates/libraryIndex";
import type { PoolEntry } from "./generationJob";
import type { ScoringStrategy, TasteVector } from "./scoring/strategy";

/** Le haut du pré-classement enrichi en métadonnées complètes (keywords…). */
const ENRICH_TOP = 120;
/** Le haut BIBLIOTHÈQUE enrichi en plus : le pré-classement global est dominé
 *  par les candidats TMDB (facettes aux ids TMDB, comme le profil) — en mode
 *  « bibliothèque seule », on servait donc des titres jamais enrichis, sans
 *  visuels ni providers alors que leurs métas dormaient en cache. */
const LIBRARY_ENRICH_TOP = 80;
/** Appels TMDB frais au plus par génération — le cache est gratuit. */
const ENRICH_FETCH_BUDGET = 60;

export interface EnrichOptions {
  /** Passe rapide : enrichissement au CACHE seul, pas un octet de réseau. */
  quick: boolean;
  includeVigie: boolean;
  profile: TasteVector;
  strategy: ScoringStrategy;
}

function slug(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "-");
}

/** Libellés des facettes nommées Jellyfin (slug → intitulé d'origine). */
function harvestLibraryLabels(library: LibraryIndex, labels: Record<string, string>): void {
  for (const entry of library.entries) {
    for (const g of entry.Genres ?? []) labels[`genre-name:${slug(g)}`] = g;
    for (const s of entry.Studios ?? []) {
      if (s.Name) labels[`studio-name:${slug(s.Name)}`] = s.Name;
    }
  }
}

/** Libellés des facettes à IDs TMDB (« director:5655 » → nom). */
function harvestLabels(meta: TitleMeta, labels: Record<string, string>): void {
  for (const g of meta.genres) labels[`genre:${g.id}`] = g.name;
  for (const k of meta.keywords) labels[`kw:${k.id}`] = k.name;
  for (const d of meta.directors) if (d.name) labels[`director:${d.id}`] = d.name;
  for (const a of meta.topCast) if (a.name) labels[`actor:${a.id}`] = a.name;
  for (const s of meta.studios) if (s.name) labels[`studio:${s.id}`] = s.name;
  for (const n of meta.networks) if (n.name) labels[`network:${n.id}`] = n.name;
}

/**
 * Enrichit le haut du panier — cache gratuit + budget de fetchs frais — et
 * re-score chaque entrée touchée (facettes complètes, visuels, votes). Mute
 * `scored` en place ; l'appelant re-trie. Rend les libellés humains des
 * facettes pour les raisons affichées.
 */
export async function enrichTopEntries(
  scored: PoolEntry[],
  library: LibraryIndex,
  opts: EnrichOptions
): Promise<Record<string, string>> {
  const labels: Record<string, string> = {};
  harvestLibraryLabels(library, labels);

  let fetchBudget = !opts.quick && tmdbConfigured() ? ENRICH_FETCH_BUDGET : 0;
  // Haut GLOBAL + haut BIBLIOTHÈQUE (cf. LIBRARY_ENRICH_TOP), dédupliqués.
  // L'ORDRE décide qui consomme le budget de fetchs : en bibliothèque seule,
  // la bibliothèque passe DEVANT — c'est elle qui est servie, dépenser le
  // budget sur des candidats TMDB jamais montrés laissait les rangées sans
  // visuels ni providers.
  const globalTop = scored.slice(0, ENRICH_TOP);
  const libraryTop: PoolEntry[] = [];
  for (const entry of scored) {
    if (libraryTop.length >= LIBRARY_ENRICH_TOP) break;
    if (entry.candidate.jellyfinItemId) libraryTop.push(entry);
  }
  const enrichSet = new Map<string, PoolEntry>();
  for (const entry of opts.includeVigie ? [...globalTop, ...libraryTop] : [...libraryTop, ...globalTop]) {
    if (!enrichSet.has(entry.candidate.key)) enrichSet.set(entry.candidate.key, entry);
  }
  const enrichTop = [...enrichSet.values()];
  // Une lecture groupée du cache pour tout le panier — le budget de fetchs
  // frais sert aux absents ET aux lignes d'avant les watch/providers.
  const cachedMeta = await getCachedMetaMany(
    enrichTop.map((e) => ({ mediaType: e.candidate.mediaType, tmdbId: e.candidate.tmdbId }))
  );
  for (const entry of enrichTop) {
    const { candidate } = entry;
    let meta = cachedMeta.get(metaKey(candidate.mediaType, candidate.tmdbId)) ?? null;
    // Méta absente OU d'avant la clé watch/providers : le budget la (re)paie —
    // c'est la mise à niveau douce du cache, jusqu'à 60 titres par génération.
    if ((!meta || meta.providers === null) && fetchBudget > 0) {
      fetchBudget--;
      meta = (await getTitleMeta(candidate.mediaType, candidate.tmdbId)) ?? meta;
    }
    if (!meta) continue;
    harvestLabels(meta, labels);
    candidate.facets = facetsFromTmdb(meta);
    // Les visuels : un candidat bibliothèque n'en a pas, la méta les fournit.
    candidate.posterPath = candidate.posterPath ?? meta.posterPath;
    candidate.backdropPath = candidate.backdropPath ?? meta.backdropPath;
    candidate.voteAverage = meta.voteAverage ?? candidate.voteAverage;
    candidate.voteCount = meta.voteCount ?? candidate.voteCount;
    candidate.popularity = meta.popularity ?? candidate.popularity;
    candidate.year = meta.year ?? candidate.year;
    entry.breakdown = opts.strategy.score(opts.profile, candidate);
  }
  return labels;
}
