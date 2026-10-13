import { getTitleMeta } from "../tmdb/metaCache";
import { watchRegion } from "../tmdb/providerNormalize";
import type { ExclusionSets } from "./candidates/exclusions";
import type { LibraryIndex } from "./candidates/libraryIndex";
import type { PoolEntry, PoolPayload } from "./generationJob";
import { enrichTopEntries } from "./poolEnrichment";
import { applyCachedProviders } from "./poolProviders";
import { gatherCandidates } from "./poolSources";
import { preparePoolTaste } from "./poolTaste";
import type { Candidate, TasteVector } from "./scoring/strategy";
import { TasteScoringStrategy } from "./scoring/tasteStrategy";
import { formatAversion, libraryExposure, universeAversion } from "./aversion";
import { refreshTitleLanguage } from "./titleLanguage";
import { themeAversion } from "./themeAversion";
import { isBlockedExplicit } from "./universes";

/**
 * Le CALCUL du pool d'un compte, sans écrire nulle part : profil, bibliothèque
 * et exclusions entrent, le pool classé sort. `generationJob` le lit en base,
 * l'écrit et prévient la page ; le banc de recommandation (test/reco-bench)
 * le nourrit d'un persona — le même moteur, mot pour mot.
 */

/** Budget dédié aux TITRES de graines muettes — séparé de l'enrichissement :
 *  une rangée « Parce que vous avez aimé » sans titre n'existe pas. */
const SEED_META_BUDGET = 8;
/** Entrées gardées du pool classé. */
const POOL_KEEP = 1000;
/** Acteurs adorés interrogés en plus des personnes aimées explicitement. */
const IMPLICIT_PEOPLE_MAX = 3;
/** Correspondance (match) du premier et du dernier du pool : monotone avec le rang. */
const MATCH_TOP = 95;
const MATCH_TAIL = 50;
/** Proximité aux goûts (relevance) qui autorise la correspondance pleine. */
const MATCH_FULL_RELEVANCE = 0.5;
/** Correspondance d'un titre sans aucune proximité aux goûts, au mieux. */
const MATCH_CEILING_FLOOR = 60;

export interface PoolProfileRow {
  facets: string;
  signalCount: number;
  animeShare: number;
  anchors: string | null;
}

export interface PoolComputeInput {
  userId: string;
  /** Passe rapide : bibliothèque et cache seulement, zéro réseau. */
  quick: boolean;
  profileRow: PoolProfileRow | null;
  /** Réglage EFFECTIF « titres hors bibliothèque » (Vigie présente et voulue). */
  includeVigie: boolean;
  library: LibraryIndex;
  likedPeople: Array<{ personId: number; name: string }>;
  exclusions: ExclusionSets;
}

export interface PoolComputeDeps {
  /** Le catalogue de Vigie — le banc le remplace par son équivalent TMDB enregistré. */
  vigieSource?: (profile: TasteVector) => Promise<Candidate[]>;
}

export interface ComputedPool {
  payload: PoolPayload;
  providers: { known: number; unknown: number };
}

function parseFacets(raw: string | undefined): Record<string, number> {
  try {
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    // Profil illisible : pool sur profil vide, le prochain rebuild réécrit.
    return {};
  }
}

function byTotalDesc(a: PoolEntry, b: PoolEntry): number {
  return b.breakdown.total - a.breakdown.total || (a.candidate.key < b.candidate.key ? -1 : 1);
}

export async function computePool(input: PoolComputeInput, deps: PoolComputeDeps = {}): Promise<ComputedPool> {
  const { quick, profileRow, includeVigie, library, likedPeople, exclusions } = input;
  const profile: TasteVector = { facets: parseFacets(profileRow?.facets), signalCount: profileRow?.signalCount ?? 0 };
  const animeShare = profileRow?.animeShare ?? 0;

  // Le classement, les graines et les voisins collaboratifs viennent des
  // ancres du profil ; un profil d'avant les ancres garde l'ancienne mécanique.
  const taste = await preparePoolTaste(input.userId, profileRow, library);
  // La langue des titres hors bibliothèque (celle de Jellyfin), avant toute liste TMDB.
  if (!quick) await refreshTitleLanguage().catch(() => null);
  const { seeds } = taste;

  // Une graine hors bibliothèque absente du cache TMDB restait sans titre —
  // et sa rangée « Parce que vous avez aimé » sautait en silence. Les plus
  // fortes d'abord (les graines arrivent triées) ; passe rapide : pas de
  // réseau, la relève complète titrera.
  if (!quick) {
    let seedMetaBudget = SEED_META_BUDGET;
    for (const seed of seeds) {
      if (seed.title || seedMetaBudget <= 0) continue;
      seedMetaBudget--;
      const meta = await getTitleMeta(seed.mediaType, seed.tmdbId, { priority: "background" });
      if (meta) seed.title = meta.title;
    }
  }

  // Les acteurs qu'il adore nourrissent aussi la source « personnes » (leurs autres
  // titres) ; les rangées « Avec X » d'avant restent aux personnes aimées EXPLICITEMENT.
  const implicitActors = taste.lovedPeople
    .filter((p) => p.role === "actor" && !likedPeople.some((l) => l.personId === p.id))
    .slice(0, IMPLICIT_PEOPLE_MAX)
    .map((p) => ({ personId: p.id, name: p.name }));
  const pool = await gatherCandidates({
    quick, includeVigie, animeShare, likedPeople: [...likedPeople, ...implicitActors], profile, library, taste,
    vigieSource: deps.vigieSource,
  });

  // Qualité : jamais de carte muette. Sans titre, ou sans image affichable
  // (affiche TMDB ou Primary Jellyfin), un candidat sort avant le classement.
  const isDisplayable = (c: Candidate): boolean => {
    if (!c.title.trim()) return false;
    if (c.posterPath) return true;
    return !!c.jellyfinItemId && library.byKey.get(c.key)?.hasPrimaryImage === true;
  };
  // Pornographie explicite (cf. universes) : bloquée HORS bibliothèque seulement — la
  // bibliothèque ne se filtre pas, et Jellyseerr applique ses filtres à ce qu'il propose.
  const explicit = (c: Candidate) => isBlockedExplicit(c);
  const kept = pool.filter((c) => !exclusions.everywhere.has(c.key) && isDisplayable(c) && !explicit(c));

  // Classement étalonné sur CE panier, enrichissement du haut (budget de
  // fetchs pour les fiches absentes), re-classement final.
  const { strategy } = taste;
  // L'aversion : ce que la bibliothèque offre face à ce que le compte regarde.
  const aversion = universeAversion(taste.anchors, taste.facetsOf, libraryExposure(pool));
  if (strategy instanceof TasteScoringStrategy) {
    strategy.setAversion(aversion, themeAversion(taste.anchors, taste.facetsOf, pool), formatAversion(taste.anchors, taste.facetsOf));
  }
  // Les échelles s'étalonnent sur les sources du GOÛT : ce que Vigie met en avant
  // (popularité, découvertes larges) les écraserait, et tout semblerait proche.
  const tasteSources = kept.filter((c) => c.source !== "vigie");
  strategy.calibrate?.(profile, tasteSources.length ? tasteSources : kept);
  let scored: PoolEntry[] = kept.map((candidate) => ({ candidate, breakdown: strategy.score(profile, candidate) }));
  scored.sort(byTotalDesc);
  const labels = await enrichTopEntries(scored, library, { quick, includeVigie, profile, strategy });
  scored.sort(byTotalDesc);
  // L'enrichissement a pu révéler le X (fiche complète) : écarté aussi.
  scored = scored.filter((e) => !explicit(e.candidate)).slice(0, POOL_KEEP);
  // La correspondance : le rang dans le pool du compte (95 en tête, 50 en queue),
  // plafonnée par la proximité aux goûts — classé haut par sa seule notoriété
  // (une procédurale du catalogue), un titre ne s'annonce pas à 88 %.
  const span = Math.max(1, scored.length - 1);
  scored.forEach((entry, i) => {
    const rank = MATCH_TOP - ((MATCH_TOP - MATCH_TAIL) * i) / span;
    const kin = Math.min(1, (entry.breakdown.relevance ?? 0) / MATCH_FULL_RELEVANCE);
    entry.match = Math.round(Math.min(rank, MATCH_CEILING_FLOOR + (MATCH_TOP - MATCH_CEILING_FLOOR) * kin));
  });

  // Les plateformes que le cache connaît déjà, pour TOUT le pool (une lecture
  // groupée) ; le reste attend le crawler. La région voyage avec le pool.
  const providers = await applyCachedProviders(scored);
  const payload: PoolPayload = {
    generatedAt: new Date().toISOString(),
    strategyId: strategy.id,
    poolSize: scored.length,
    includeVigie,
    animeShare,
    aversion,
    lovedPeople: taste.lovedPeople,
    preliminary: quick,
    people: likedPeople,
    providersRegion: watchRegion(),
    seeds,
    entries: scored,
    labels,
  };
  return { payload, providers };
}
