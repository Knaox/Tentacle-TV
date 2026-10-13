import { bayesianRating } from "./bayes";

/**
 * Pondération du classement à ancres. Chaque composante est d'abord ramenée
 * dans 0..1 par une saturation calibrée sur le panier du compte (cf.
 * calibrate) : les poids disent enfin ce qu'ils pèsent. L'ancienne formule
 * gardait la similarité dans 0,50..0,56 — la récence et la note TMDB, les
 * mêmes pour tous, décidaient seules du classement.
 */
export interface TasteWeights {
  /** Proximité aux titres aimés, un par un. */
  relevance: number;
  /** Soutien des graines (recommandations TMDB cumulées). */
  seed: number;
  /** Affinité au profil moyen (langue, époque, genres dominants). */
  profile: number;
  quality: number;
  /** Récence, modulée par l'appétit du compte pour les nouveautés. */
  freshness: number;
  /** Ressemblance aux refus et abandons (soustraite). */
  negative: number;
  /** Notoriété (nombre de votes TMDB) — repli d'un compte sans calibration
   *  (moins de trois titres regardés). */
  familiarity: number;
  /** Adéquation à la calibration du COMPTE (notoriété et époque de ce qu'il
   *  regarde) : remplace la notoriété brute, dans les deux sens. */
  calibration: number;
  /** Univers que le compte évite (aversion par l'exposition, soustraite). */
  aversion: number;
  /** Sous la barre de qualité du compte (soustraite). */
  qualityBar: number;
  /** Une personne qu'il adore (acteur, réalisateur, créateur) est au générique. */
  lovedPeople: number;
  /** Thèmes denses que le compte évite (isekai d'une saison d'animés, soustraits). */
  themeAversion: number;
  /** Ancres retenues par candidat : ses plus proches voisins aimés. */
  neighbors: number;
  /** Exposant de la similarité : > 1, une correspondance franche l'emporte
   *  sur dix correspondances vagues. */
  sharpness: number;
}

/** Réglage retenu au banc (titres aimés cachés, 13 comptes) : trois fois plus
 *  de titres aimés retrouvés dans les 30 premiers que l'ancienne formule, et
 *  quatre titres communs sur 50 entre deux comptes au lieu de trente-quatre. */
export const DEFAULT_TASTE_WEIGHTS: Readonly<TasteWeights> = {
  relevance: 0.5,
  seed: 0.2,
  profile: 0.08,
  quality: 0.25,
  freshness: 0.2,
  // Un refus doit éloigner ses voisins : à 0,25, un titre très proche de trois
  // refus (trois séries d'un même genre refusées) restait dans le haut du panier.
  negative: 0.45,
  familiarity: 0.25,
  calibration: 0.3,
  aversion: 0.45,
  qualityBar: 0.35,
  lovedPeople: 0.2,
  themeAversion: 0.5,
  neighbors: 5,
  sharpness: 1.5,
};

/** Votes TMDB au-delà desquels un titre est pleinement « reconnu ». */
const FAMILIAR_VOTES = 20_000;

/** Notoriété 0..1 : log du nombre de votes, plein à FAMILIAR_VOTES. */
export function familiarityOf(voteCount: number | null): number {
  const v = Math.max(0, voteCount ?? 0);
  return Math.min(1, Math.log10(1 + v) / Math.log10(1 + FAMILIAR_VOTES));
}

/** Note bayésienne ramenée à 0..1 entre ces bornes : 5,5 = médiocre, 8,2 = excellent. */
const QUALITY_LOW = 5.5;
const QUALITY_HIGH = 8.2;
export const TOP_CONTRIBUTORS = 5;
export const TOP_ANCHORS = 5;
/** Écart de note (lissée) sous la barre où la pénalité est pleine. */
export const BAR_SPAN = 0.8;
/** Proximité aux goûts au-delà de laquelle un animé passe la barre de l'univers. */
export const ANIME_STRONG_KIN = 0.6;
/** Années avant l'époque de ses animés adorés où l'écart est plein (graduel avant). */
export const ANIME_ERA_SPAN = 4;
/** Part d'un refus de feuilleton-fleuve face à un titre d'un autre format. */
export const FORMAT_REFUSAL_SHARE = 0.5;
/** Part d'un refus d'une autre décennie (dix ans d'écart), puis de vingt ans et plus. */
export const ERA_REFUSAL_NEAR = 0.75;
export const ERA_REFUSAL_FAR = 0.5;

/** Ce qui EXPLIQUE un refus : son format, son époque, sa saga (lus sur les facettes). */
export interface RefusalTraits {
  formats?: readonly string[];
  decade?: number | null;
  collections?: readonly string[];
}

/** Pur : les traits d'un titre d'après ses clés de facettes. */
export function refusalTraitsOf(keys: Iterable<string>): RefusalTraits {
  const formats: string[] = [];
  const collections: string[] = [];
  let decade: number | null = null;
  for (const key of keys) {
    if (key.startsWith("format:")) formats.push(key);
    else if (key.startsWith("collection:")) collections.push(key);
    else if (key.startsWith("decade:")) decade = Number(key.slice("decade:".length));
  }
  return { formats, decade: Number.isFinite(decade) ? decade : null, collections };
}

/**
 * Pur : la part d'un refus qui vaut contre ce candidat — ce qui EXPLIQUE le
 * refus, pas le seul genre. Même saga : entière. Sinon un autre format compte
 * moitié (un fleuve refusé face à un titre court), une autre époque aussi (dix
 * ans : trois quarts, vingt : moitié). Un shōnen de 2024 en douze épisodes après
 * un fleuve refusé de 2004 : un quart ; un fleuve de la même décennie : entier.
 */
export function refusalShare(refused: RefusalTraits, candidate: RefusalTraits): number {
  if (refused.collections?.some((c) => candidate.collections?.includes(c))) return 1;
  let share = (refused.formats ?? []).some((f) => !(candidate.formats ?? []).includes(f)) ? FORMAT_REFUSAL_SHARE : 1;
  if (refused.decade != null && candidate.decade != null) {
    const gap = Math.abs(refused.decade - candidate.decade);
    if (gap >= 20) share *= ERA_REFUSAL_FAR;
    else if (gap >= 10) share *= ERA_REFUSAL_NEAR;
  }
  return share;
}
/** Titres adorés d'une même personne pour un bonus plein. */
export const LOVED_FULL = 4;
/** Votes sous lesquels un titre n'est pas encore validé par le public ; au-delà du second, il l'est. */
const LOW_EVIDENCE_VOTES = 150;
const VALIDATED_VOTES = 600;

/** 1 pour un titre à moins de 150 votes TMDB, 0 dès 600 (échelle log). */
export function lowEvidence(voteCount: number | null): number {
  const v = Math.log10(1 + Math.max(0, voteCount ?? 0));
  const lo = Math.log10(LOW_EVIDENCE_VOTES);
  const hi = Math.log10(VALIDATED_VOTES);
  return Math.min(1, Math.max(0, (hi - v) / (hi - lo)));
}

/** Quantile d'une liste (non triée) ; 0 si vide. */
export function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

/** Saturation douce : 0 → 0, l'échelle → 0,63, deux échelles → 0,86. */
export function saturate(value: number, scale: number): number {
  if (!(value > 0) || !(scale > 0)) return 0;
  return 1 - Math.exp(-value / scale);
}

export function qualityOf(voteAverage: number | null, voteCount: number | null): number {
  const wr = bayesianRating(voteAverage, voteCount);
  return Math.min(1, Math.max(0, (wr - QUALITY_LOW) / (QUALITY_HIGH - QUALITY_LOW)));
}

