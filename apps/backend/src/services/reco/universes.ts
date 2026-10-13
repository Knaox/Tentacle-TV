import type { TitleMeta } from "../tmdb/metaCache";

/**
 * Les UNIVERS d'un titre que le moteur apprend compte par compte (aversion par
 * l'exposition) et que le banc juge : l'animé, l'animation familiale, les
 * grandes franchises. Un univers n'est ni bon ni mauvais : il est regardé ou
 * pas — un fan de Marvel reçoit du Marvel, une famille du Pixar.
 */
export type TitleUniverse = "anime" | "kidsAnimation" | "franchise";

export const UNIVERSES: readonly TitleUniverse[] = ["anime", "kidsAnimation", "franchise"];

/** Clés de facette posées sur les titres de ces univers (cf. facets). */
export const UNIVERSE_FACET: Readonly<Record<TitleUniverse, string>> = {
  anime: "universe:anime",
  kidsAnimation: "universe:kids-animation",
  franchise: "universe:franchise",
};

/** Genre TMDB « Animation » (films et séries). */
export const TMDB_GENRE_ANIMATION = 16;
/** Mot-clé TMDB « anime » — le discriminant canonique. */
export const TMDB_KEYWORD_ANIME = 210024;

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

const TMDB_GENRE_FAMILY = 10751;
const TMDB_GENRE_KIDS = 10762;
/**
 * Studios d'animation FAMILIALE (ids TMDB relevés) : une série animée qui en
 * sort est de l'animation familiale même sans le genre « Famille » — TMDB ne le
 * pose pas toujours sur les séries (une série DreamWorks, par exemple).
 */
const FAMILY_ANIMATION_STUDIOS: ReadonlySet<number> = new Set([
  3, // Pixar
  2, // Walt Disney Pictures
  6125, // Walt Disney Animation Studios
  3475, // Disney Television Animation
  521, // DreamWorks Animation
  42141, // DreamWorks Animation Television
  6704, // Illumination
  9383, // Blue Sky Studios
  4859, // Nickelodeon Animation Studio
]);

/** Pur : l'animation familiale dès la liste (genres seuls) — sans fiche, un candidat la porte déjà. */
export function isKidsAnimationCoarse(genreIds: readonly number[]): boolean {
  return genreIds.includes(TMDB_GENRE_ANIMATION) && (genreIds.includes(TMDB_GENRE_FAMILY) || genreIds.includes(TMDB_GENRE_KIDS));
}
/** Studios des grandes franchises (ids TMDB stables). */
const FRANCHISE_STUDIOS: ReadonlySet<number> = new Set([
  420, // Marvel Studios
  7505, // Marvel Entertainment
  19551, // Marvel Enterprises
  1, // Lucasfilm Ltd.
  128064, // DC Films
  9993, // DC Entertainment
  429, // DC Comics
  3, // Pixar
  2, // Walt Disney Pictures
  6125, // Walt Disney Animation Studios
  521, // DreamWorks Animation
  6704, // Illumination
]);
/** Mots-clés des franchises (super-héros, comics, univers étendus). */
const FRANCHISE_KEYWORDS: ReadonlySet<number> = new Set([
  9715, // superhero
  9717, // based on comic
  180547, // marvel cinematic universe (mcu)
  229266, // dc extended universe (dceu)
]);

export function universesOfMeta(
  meta: Pick<TitleMeta, "genres" | "keywords" | "originalLanguage" | "originCountry" | "studios">
): TitleUniverse[] {
  const out: TitleUniverse[] = [];
  const anime = isAnimeTmdb(meta);
  if (anime) out.push("anime");
  const genres = new Set(meta.genres.map((g) => g.id));
  // Un Ghibli familial est des DEUX univers : une famille qui en regarde ne le perd
  // pas parce qu'elle ne regarde pas de shōnen (cf. aversionOf, le plus favorable).
  const familyStudio = meta.studios.some((s) => FAMILY_ANIMATION_STUDIOS.has(s.id));
  if (genres.has(TMDB_GENRE_ANIMATION) && (genres.has(TMDB_GENRE_FAMILY) || genres.has(TMDB_GENRE_KIDS) || familyStudio)) {
    out.push("kidsAnimation");
  }
  // Une saga seule n'en fait pas une franchise (Sicario, Mad Max) : les studios
  // et les mots-clés des grands univers, oui.
  const franchise =
    meta.studios.some((s) => FRANCHISE_STUDIOS.has(s.id)) || meta.keywords.some((k) => FRANCHISE_KEYWORDS.has(k.id));
  if (franchise) out.push("franchise");
  return out;
}

/**
 * Contenu pour ADULTES : seule la pornographie explicite — le drapeau « adult »
 * de TMDB, ou un mot-clé de cette liste fermée. Le contenu sexuel n'est pas
 * filtré (ecchi, drames qui montrent des violences) : la règle est de ne
 * bloquer que le X, et seulement hors bibliothèque (cf. poolCompute) — ce que
 * l'administrateur a mis dans Jellyfin ne se filtre pas, et Jellyseerr applique
 * ses propres filtres à ce qu'il propose.
 */
export const EXPLICIT_FACET = "content:explicit";
const EXPLICIT_KEYWORDS: ReadonlySet<string> = new Set(["hentai", "pornography"]);
/**
 * Titres X que TMDB ne marque PAS « adult » (liste FERMÉE, clés TMDB) : bloqués
 * hors bibliothèque comme le reste du X. Un ajout ici se décide titre par
 * titre — le contenu sexuel en général n'y entre pas.
 */
export const EXPLICIT_TITLES: ReadonlySet<string> = new Set([
  "tv:99071", // Redo of Healer (Kaifuku Jutsushi no Yarinaoshi)
]);

/** Pur : le titre est-il de la pornographie explicite ? */
export function isExplicitMeta(
  meta: Pick<TitleMeta, "keywords"> & { adult?: boolean; mediaType?: TitleMeta["mediaType"]; tmdbId?: number }
): boolean {
  if (meta.adult === true) return true;
  if (meta.mediaType && meta.tmdbId != null && EXPLICIT_TITLES.has(`${meta.mediaType}:${meta.tmdbId}`)) return true;
  return meta.keywords.some((k) => EXPLICIT_KEYWORDS.has(k.name.trim().toLowerCase()));
}

/** Pur : un candidat HORS bibliothèque qui est du X (fiche, drapeau de liste, liste fermée). La bibliothèque ne se filtre jamais. */
export function isBlockedExplicit(c: { key: string; jellyfinItemId?: string | null; facets: readonly { key: string }[] }): boolean {
  return !c.jellyfinItemId && (EXPLICIT_TITLES.has(c.key) || c.facets.some((f) => f.key === EXPLICIT_FACET));
}

/** Les univers d'un titre d'après ses clés de facettes (univers posés par facetsFromTmdb). */
export function universesOfFacets(keys: Iterable<string>): TitleUniverse[] {
  const set = new Set(keys);
  return UNIVERSES.filter((u) => set.has(UNIVERSE_FACET[u]));
}

/**
 * Le FORMAT d'une série : un feuilleton-fleuve, cent épisodes et plus —
 * shōnen interminable, procédurale, sitcom. Les années d'antenne ne suffisent
 * pas (mesuré : des séries de 80 à 90 épisodes sur dix
 * ans, ne sont pas des fleuves). Ce n'est pas un goût de contenu mais une façon
 * de regarder : la facette ne pèse rien dans les similarités (multiplicateur
 * nul), seuls les REFUS la font compter (cf. formatAversion).
 */
export const FORMAT_LONG_RUNNING = "format:long-running";
const LONG_RUNNING_EPISODES = 100;

export function isLongRunningMeta(meta: Pick<TitleMeta, "mediaType" | "episodeCount">): boolean {
  return meta.mediaType === "tv" && (meta.episodeCount ?? 0) >= LONG_RUNNING_EPISODES;
}

/**
 * Le MONDE d'un titre : animé japonais, autre animation, prises de vues réelles.
 * Une parenté (« Parce que… ») ne passe pas d'un monde à l'autre.
 */
export type ContentWorld = "anime" | "animation" | "live";
const ANIMATION_KEYS: ReadonlySet<string> = new Set([UNIVERSE_FACET.kidsAnimation, `genre:${TMDB_GENRE_ANIMATION}`, "genre-name:animation"]);

export function contentWorldOf(keys: Iterable<string>): ContentWorld {
  let animated = false;
  for (const key of keys) {
    if (key === UNIVERSE_FACET.anime) return "anime";
    if (ANIMATION_KEYS.has(key)) animated = true;
  }
  return animated ? "animation" : "live";
}
