import type { TitleMeta } from "../tmdb/metaCache";
import { DEFAULT_FACET_WEIGHTS, FACET_STOP_KEYWORDS, NETWORKS_MAX, STUDIOS_MAX } from "./facetWeights";
import type { FacetWeights } from "./facetWeights";

/** Une facette d'un titre, avec son multiplicateur intrinsèque. */
export interface FacetEntry {
  key: string;
  mult: number;
}

/** Bucket de durée : < 90, 90-120, 120-150, > 150 minutes. */
export function runtimeBucket(minutes: number): "short" | "standard" | "long" | "epic" {
  if (minutes < 90) return "short";
  if (minutes <= 120) return "standard";
  if (minutes <= 150) return "long";
  return "epic";
}

export function decadeOf(year: number): number {
  return Math.floor(year / 10) * 10;
}

// ── Univers « animé » ───────────────────────────────────────────────────────
// `universe:anime` est la SEULE clé partagée entre le monde TMDB (ids) et le
// monde Jellyfin (noms), avec decade:/lang:/runtime:. C'est le pont qui
// manquait : un profil nourri d'animés de bibliothèque et un candidat
// /discover ne se rencontraient sur rien — l'animé pesait dans le vide.

export const ANIME_UNIVERSE_KEY = "universe:anime";
/** Genre TMDB « Animation » (films et séries). */
export const TMDB_GENRE_ANIMATION = 16;
/** Mot-clé TMDB « anime » — le discriminant canonique. */
export const TMDB_KEYWORD_ANIME = 210024;
/** Seuil UNIQUE de part d'univers (source /discover animé, quota des rangées
 *  mixtes, rangée dédiée). En dessous, tout est inerte — pas un appel TMDB. */
export const ANIME_MIN_SHARE = 0.05;
/** Facettes que TOUT animé porte — retirées du jaccard quand on diversifie
 *  ENTRE animés : sinon deux animés se ressemblent toujours à moitié. */
export const ANIME_COMMON_FACETS: ReadonlySet<string> = new Set([
  ANIME_UNIVERSE_KEY,
  `genre:${TMDB_GENRE_ANIMATION}`,
  "lang:ja",
  `kw:${TMDB_KEYWORD_ANIME}`,
  "genre-name:anime",
]);

/** Animé au sens d'une LISTE TMDB (genre_ids + langue, sans mots-clés) :
 *  Animation ET (japonais OU produit au Japon). Rick et Morty : non. */
export function isAnimeCoarse(
  genreIds: readonly number[],
  originalLanguage?: string | null,
  originCountry?: readonly string[]
): boolean {
  if (!genreIds.includes(TMDB_GENRE_ANIMATION)) return false;
  return originalLanguage === "ja" || (originCountry ?? []).includes("JP");
}

/** Animé au sens d'une FICHE TMDB : le mot-clé « anime » vaut aussi (une
 *  coproduction doublée en anglais reste un animé). */
export function isAnimeTmdb(
  meta: Pick<TitleMeta, "genres" | "keywords" | "originalLanguage" | "originCountry">
): boolean {
  if (!meta.genres.some((g) => g.id === TMDB_GENRE_ANIMATION)) return false;
  return (
    meta.originalLanguage === "ja" ||
    meta.keywords.some((k) => k.id === TMDB_KEYWORD_ANIME) ||
    meta.originCountry.includes("JP")
  );
}

/** Animé au sens JELLYFIN : le genre « Anime » (posé par AniDB) ou un id
 *  AniDB/AniList — jamais le seul « Animation », qui couvre South Park. */
export function isAnimeJellyfin(item: JellyfinFacetSource): boolean {
  if ((item.Genres ?? []).some((g) => g.trim().toLowerCase() === "anime")) return true;
  return Object.keys(item.ProviderIds ?? {}).some((k) => /^(anidb|anilist)$/i.test(k));
}

/** Un ensemble de clés de facettes porte-t-il l'univers animé ? */
export function hasAnimeUniverse(keys: Iterable<string>): boolean {
  for (const key of keys) if (key === ANIME_UNIVERSE_KEY) return true;
  return false;
}

/**
 * L'enrichissement TMDB REMPLACE les facettes d'un candidat : les clés
 * `universe:` posées avant lui (liste TMDB, Jellyfin) survivent ici — une
 * fiche muette sur le pays et la langue ne « désanime » pas un titre.
 */
export function mergeUniverseFacets(prev: readonly FacetEntry[], next: FacetEntry[]): FacetEntry[] {
  const known = new Set(next.map((f) => f.key));
  const kept = prev.filter((f) => f.key.startsWith("universe:") && !known.has(f.key));
  return kept.length === 0 ? next : [...next, ...kept];
}

/**
 * Facettes d'un titre depuis ses métadonnées TMDB. Espaces de clés par
 * préfixe : `genre:`/`kw:`/`director:`/`actor:`/`studio:`/`network:` portent
 * des IDs TMDB ; `decade:`/`lang:`/`runtime:`/`universe:` sont neutres et
 * partagés avec l'extraction Jellyfin. Les mots-clés de production sont
 * écartés, studios et chaînes plafonnés (cf. facetWeights) ; la durée ne vaut
 * que pour un film — celle d'une série est la durée d'un épisode, 25 minutes
 * pour presque toutes, donc un « court » commun à tout le catalogue.
 */
export function facetsFromTmdb(
  meta: TitleMeta,
  weights: Readonly<FacetWeights> = DEFAULT_FACET_WEIGHTS
): FacetEntry[] {
  const out: FacetEntry[] = [];
  const animation = meta.genres.some((g) => g.id === TMDB_GENRE_ANIMATION);
  for (const g of meta.genres) out.push({ key: `genre:${g.id}`, mult: weights.genre });
  // Les keywords sont la facette la plus discriminante du profil.
  for (const k of meta.keywords) {
    if (!FACET_STOP_KEYWORDS.has(k.id)) out.push({ key: `kw:${k.id}`, mult: weights.keyword });
  }
  const authorMult = meta.mediaType === "movie" ? weights.director : weights.creator;
  for (const d of meta.directors) out.push({ key: `director:${d.id}`, mult: authorMult });
  const actorMult = animation ? weights.voiceActor : weights.actor;
  for (const a of meta.topCast) out.push({ key: `actor:${a.id}`, mult: actorMult });
  for (const s of meta.studios.slice(0, STUDIOS_MAX)) out.push({ key: `studio:${s.id}`, mult: weights.studio });
  for (const n of meta.networks.slice(0, NETWORKS_MAX)) {
    out.push({ key: `network:${n.id}`, mult: weights.network });
  }
  if (meta.year != null) out.push({ key: `decade:${decadeOf(meta.year)}`, mult: weights.decade });
  if (meta.originalLanguage) out.push({ key: `lang:${meta.originalLanguage}`, mult: weights.lang });
  if (meta.mediaType === "movie" && meta.runtimeMinutes != null && meta.runtimeMinutes > 0) {
    out.push({ key: `runtime:${runtimeBucket(meta.runtimeMinutes)}`, mult: weights.runtime });
  }
  if (isAnimeTmdb(meta)) out.push({ key: ANIME_UNIVERSE_KEY, mult: weights.universe });
  return out;
}

/** Champs Jellyfin suffisants pour des facettes de repli (sans TMDB). */
export interface JellyfinFacetSource {
  Genres?: string[];
  Studios?: Array<{ Name?: string }>;
  ProductionYear?: number;
  RunTimeTicks?: number;
  /** Langue d'origine si connue (rarement exposée par Jellyfin). */
  OriginalLanguage?: string;
  /** Ids externes — AniDB/AniList signent un animé. */
  ProviderIds?: Record<string, string>;
  /** Type Jellyfin (« Series ») ou type canonique (« tv ») : la durée d'une
   *  fiche Series est celle d'un épisode, elle ne fait pas facette. */
  Type?: string;
  mediaType?: "movie" | "tv";
}

const TICKS_PER_MINUTE = 600_000_000;

function slug(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "-");
}

/**
 * Facettes de repli depuis un item Jellyfin — espaces `genre-name:` /
 * `studio-name:` distincts des IDs TMDB : les deux mondes ne doivent jamais
 * se mélanger dans le même compteur IDF. Seul `universe:` traverse.
 */
export function facetsFromJellyfin(
  item: JellyfinFacetSource,
  weights: Readonly<FacetWeights> = DEFAULT_FACET_WEIGHTS
): FacetEntry[] {
  const out: FacetEntry[] = [];
  for (const g of item.Genres ?? []) {
    if (g) out.push({ key: `genre-name:${slug(g)}`, mult: weights.genre });
  }
  for (const s of (item.Studios ?? []).slice(0, STUDIOS_MAX)) {
    if (s.Name) out.push({ key: `studio-name:${slug(s.Name)}`, mult: weights.studio });
  }
  if (item.ProductionYear) {
    out.push({ key: `decade:${decadeOf(item.ProductionYear)}`, mult: weights.decade });
  }
  if (item.OriginalLanguage) out.push({ key: `lang:${item.OriginalLanguage}`, mult: weights.lang });
  const series = item.Type === "Series" || item.mediaType === "tv";
  if (!series && item.RunTimeTicks && item.RunTimeTicks > 0) {
    const minutes = item.RunTimeTicks / TICKS_PER_MINUTE;
    out.push({ key: `runtime:${runtimeBucket(minutes)}`, mult: weights.runtime });
  }
  if (isAnimeJellyfin(item)) out.push({ key: ANIME_UNIVERSE_KEY, mult: weights.universe });
  return out;
}
