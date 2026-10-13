import type { PoolEntry } from "./generationJob";
import { REGISTER_MIN_LOVED, registerCount } from "./lovedTaste";
import type { LovedPerson } from "./lovedTaste";
import { UNIVERSE_FACET, contentWorldOf } from "./universes";

/**
 * Les FILTRES des rangées tirées du pool : graines distinctives, remplissage,
 * franchises. Purs ; rowBuilder les applique.
 */
/** Au-delà, une graine est un carrefour de franchise : pas de « Parce que… » à son nom. */
export const SEED_FRANCHISE_MAX = 0.5;
/** Titres d'une franchise au plus dans une rangée « Parce que… ». */
export const BECAUSE_FRANCHISE_MAX = 3;

export function isFranchiseEntry(e: PoolEntry): boolean {
  return e.candidate.facets.some((f) => f.key === UNIVERSE_FACET.franchise);
}

/** Au-delà, un titre est trop loin sous la barre du compte pour remplir une rangée. */
const FILL_QUALITY_GAP_MAX = 0.35;

/** Une rangée ne se remplit pas de ce qui déçoit le compte (sous sa barre, univers ou thème évité). */
export function worthFilling(e: PoolEntry): boolean {
  return (e.breakdown.qualityGap ?? 0) < FILL_QUALITY_GAP_MAX && (e.breakdown.aversion ?? 0) < 0.5;
}

/** Proximité aux goûts exigée d'un parent de graine (réglée au banc, cf. passe 5). */
export const KIN_MIN_RELEVANCE = 0.2;
/** Les titres aimés que cite la raison « similarTo » (cf. recoWhy) : les deux premiers. */
export const KIN_CITED = 2;
/** Parenté de CONTENU minimale au titre de la graine (similarité TF-IDF, sans son poids) —
 *  mesurée au banc : les vrais parents (même auteur, mêmes thèmes) sont au-dessus,
 *  entre 0,3 et 0,55 ; les voisins de genre seul en dessous, de 0,13 à 0,19. */
export const KIN_MIN_SIMILARITY = 0.22;

/** Pur : un titre d'animation (animé japonais compris), d'après ses facettes (cf. contentWorldOf). */
export function isAnimated(keys: Iterable<string>): boolean {
  return contentWorldOf(keys) !== "live";
}

/**
 * Un VRAI parent de la graine : la raison du titre la CITE (elle est parmi les
 * deux titres aimés qui portent le plus son score), il lui ressemble par le
 * contenu (auteurs, thèmes, genres pondérés par l'IDF), il plaît au compte, il
 * ne déçoit pas, et il est du même monde (animé, animation, prises de vues
 * réelles). Être recommandé par TMDB ne suffit pas.
 */
export function isRealKin(e: PoolEntry, seed: { key: string; universes?: string[]; animated?: boolean }): boolean {
  const cited = (e.breakdown.topAnchors ?? []).filter((a) => a.liked !== false && a.title.trim()).slice(0, KIN_CITED);
  const own = cited.find((a) => a.key === seed.key);
  if (!own || (own.similarity ?? 1) < KIN_MIN_SIMILARITY) return false;
  if ((e.breakdown.relevance ?? 0) < KIN_MIN_RELEVANCE || !worthFilling(e)) return false;
  const keys = e.candidate.facets.map((f) => f.key);
  // Sans fiche (aucun mot-clé connu), la parenté ne tient qu'aux genres : elle ne se prouve pas.
  if (!keys.some((k) => k.startsWith("kw:"))) return false;
  if (seed.animated !== undefined && seed.animated !== isAnimated(keys)) return false;
  if (!seed.universes) return true;
  return seed.universes.includes(UNIVERSE_FACET.anime) === keys.includes(UNIVERSE_FACET.anime);
}

/** Un titre d'une personne adorée, dans SON registre (cf. registerCount) ; vieux pool : tous. */
export function inPersonRegister(e: PoolEntry, facet: string, person?: Pick<LovedPerson, "key" | "count" | "genres">): boolean {
  const keys = e.candidate.facets.map((f) => f.key);
  if (!keys.includes(facet)) return false;
  return !person?.genres || registerCount(person, keys) >= REGISTER_MIN_LOVED;
}

/** Votes TMDB sous lesquels une note ne dit rien : un tel titre ne remplit aucune rangée. */
export const ROW_MIN_VOTES = 50;

/**
 * Pur : le titre a une note qui dit quelque chose — noté, et par au moins
 * cinquante votants. Votes inconnus : seul un titre de la bibliothèque passe
 * (noté par Jellyfin, sans fiche TMDB) ; un titre obscur hors bibliothèque, jamais.
 */
export function hasEvidence(e: PoolEntry): boolean {
  const c = e.candidate;
  if (!((c.voteAverage ?? 0) > 0)) return false;
  return c.voteCount == null ? !!c.jellyfinItemId : c.voteCount >= ROW_MIN_VOTES;
}

/** Titres d'une même saga TMDB au plus dans une rangée. */
export const COLLECTION_MAX_PER_ROW = 2;

/**
 * Pur : au plus deux titres d'une même saga (quatre Harry Potter ne font pas
 * une rangée) — sauf une saga que le compte SUIT (son profil la porte) : un fan
 * de Marvel reçoit du Marvel.
 */
export function capPerCollection(
  entries: readonly PoolEntry[],
  followed: Readonly<Record<string, number>> = {},
  max = COLLECTION_MAX_PER_ROW
): PoolEntry[] {
  const seen = new Map<string, number>();
  return entries.filter((e) => {
    const saga = e.candidate.facets.find((f) => f.key.startsWith("collection:"))?.key;
    if (!saga || (followed[saga] ?? 0) > 0) return true;
    const n = seen.get(saga) ?? 0;
    seen.set(saga, n + 1);
    return n < max;
  });
}
