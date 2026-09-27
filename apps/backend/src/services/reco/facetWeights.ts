/**
 * Poids intrinsèques des familles de facettes — ce que « partager » une facette
 * dit de deux titres, AVANT l'IDF. Réglés au banc d'évaluation (titres aimés
 * cachés puis retrouvés) : un acteur partagé comptait autant qu'un genre, un
 * studio de comité de production autant qu'un réalisateur.
 */
export interface FacetWeights {
  genre: number;
  keyword: number;
  /** Réalisateur d'un film — la signature d'auteur. */
  director: number;
  /** Créateur d'une série (created_by) — la même clé `director:`, moins décisif. */
  creator: number;
  actor: number;
  /** Acteur d'une ANIMATION : une voix, pas un visage — elle dit peu du goût. */
  voiceActor: number;
  studio: number;
  network: number;
  decade: number;
  lang: number;
  runtime: number;
  universe: number;
}

export const DEFAULT_FACET_WEIGHTS: Readonly<FacetWeights> = {
  genre: 1,
  // Des dizaines par titre, souvent anecdotiques : à 1, ils noyaient genres
  // et auteurs (mesuré : 0,5 retrouve un tiers de titres aimés en plus).
  keyword: 0.5,
  director: 2,
  creator: 1.6,
  actor: 0.8,
  voiceActor: 0.3,
  studio: 0.6,
  network: 0.6,
  decade: 0.5,
  lang: 0.7,
  runtime: 0.3,
  universe: 1,
};

/** Studios retenus par titre : les premiers de TMDB sont les producteurs
 *  principaux ; au-delà, un comité de production (dentsu, Shueisha…) qui
 *  relie des titres sans rapport. */
export const STUDIOS_MAX = 3;
/** Chaînes retenues par série : la diffusion d'origine, pas les rediffusions
 *  régionales (un animé passe sur une dizaine de chaînes japonaises). */
export const NETWORKS_MAX = 2;

/**
 * Mots-clés TMDB qui décrivent la PRODUCTION, pas un goût : ils reliaient
 * Twilight 5 à Toy Story 3 (« suite ») et faisaient d'une scène après le
 * générique le premier trait d'un profil. Ids TMDB stables.
 */
export const FACET_STOP_KEYWORDS: ReadonlySet<number> = new Set([
  179430, // aftercreditsstinger
  179431, // duringcreditsstinger
  187056, // woman director
  263548, // short film
  9663, // sequel
  9714, // remake
  15285, // spin off
  818, // based on novel or book
  11162, // miniseries
]);
