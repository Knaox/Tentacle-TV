/**
 * Le catalogue du banc du contrôle parental : une petite médiathèque FACTICE
 * (vidéos de quatre secondes) dont chaque titre porte une classification
 * française de la table de Jellyfin (`U` 0, `6+`, `10`, `12`, `16`, `18`, `X`
 * 1000) ou AUCUNE, quelques étiquettes, et un VRAI identifiant TMDB — pour que
 * recommandations, sagas et Vigie s'y raccrochent.
 *
 * Quatre bibliothèques : Films et Séries, ouvertes au compte restreint,
 * « Réservée » et « Réservée séries », qui lui sont refusées. Les classifications sont celles du .nfo
 * (métadonnées verrouillées, aucun fournisseur Internet) : c'est Jellyfin qui
 * juge, le banc ne fait que comparer.
 */

export type LibraryKey = "films" | "series" | "reserved" | "reservedSeries";

export interface LibrarySpec {
  key: LibraryKey;
  name: string;
  collectionType: "movies" | "tvshows";
  /** Dossier sous `/media`. */
  folder: string;
}

export const LIBRARIES: LibrarySpec[] = [
  { key: "films", name: "Films", collectionType: "movies", folder: "films" },
  { key: "series", name: "Séries", collectionType: "tvshows", folder: "series" },
  { key: "reserved", name: "Réservée", collectionType: "movies", folder: "reservee" },
  { key: "reservedSeries", name: "Réservée séries", collectionType: "tvshows", folder: "reservee-series" },
];

export interface MovieSpec {
  library: "films" | "reserved";
  title: string;
  year: number;
  tmdbId: number;
  /** Classification du .nfo ; absente = non classé. */
  rating?: string;
  tags?: string[];
}

export interface EpisodeSpec {
  season: number;
  episode: number;
  title: string;
  /** Classification propre à l'épisode (sinon celle de la série). */
  rating?: string;
}

export interface SeriesSpec {
  /** « series » par défaut. */
  library?: "series" | "reservedSeries";
  title: string;
  year: number;
  tmdbId: number;
  rating?: string;
  tags?: string[];
  episodes: EpisodeSpec[];
}

/** Étiquette bloquée au compte restreint. */
export const BLOCKED_TAG = "cauchemar";

export const MOVIES: MovieSpec[] = [
  { library: "films", title: "Toy Story", year: 1995, tmdbId: 862, rating: "U", tags: ["animation"] },
  { library: "films", title: "Le Monde de Nemo", year: 2003, tmdbId: 12, rating: "U" },
  { library: "films", title: "Le Roi lion", year: 1994, tmdbId: 8587, rating: "6+" },
  { library: "films", title: "Coraline", year: 2009, tmdbId: 14836, rating: "10" },
  { library: "films", title: "The Dark Knight", year: 2008, tmdbId: 155, rating: "12" },
  { library: "films", title: "Joker", year: 2019, tmdbId: 475557, rating: "12" },
  { library: "films", title: "Fight Club", year: 1999, tmdbId: 550, rating: "16" },
  { library: "films", title: "Saw", year: 2004, tmdbId: 176, rating: "18", tags: [BLOCKED_TAG] },
  { library: "films", title: "Big Buck Bunny", year: 2008, tmdbId: 10378 },
  { library: "films", title: "Le Voyage de Chihiro", year: 2001, tmdbId: 129, rating: "U", tags: [BLOCKED_TAG] },
  { library: "films", title: "Sintel", year: 2010, tmdbId: 45745, rating: "X" },
  { library: "reserved", title: "Le Petit Prince", year: 2015, tmdbId: 309809, rating: "U" },
  { library: "reserved", title: "Wallace et Gromit : Le Mystère du lapin-garou", year: 2005, tmdbId: 533, rating: "U" },
];

export const SERIES: SeriesSpec[] = [
  {
    title: "Bluey", year: 2018, tmdbId: 82728, rating: "U",
    // Un épisode classé plus haut que sa série : Jellyfin le juge seul.
    episodes: [{ season: 1, episode: 1, title: "Les Mamans magiques" }, { season: 1, episode: 2, title: "Le Grand Saut", rating: "16" }],
  },
  { title: "Peppa Pig", year: 2004, tmdbId: 12225, rating: "6+", episodes: [{ season: 1, episode: 1, title: "Les Flaques de boue" }] },
  { title: "Avatar, le dernier maître de l'air", year: 2005, tmdbId: 246, rating: "10", episodes: [{ season: 1, episode: 1, title: "Le Garçon dans l'iceberg" }] },
  { title: "Stranger Things", year: 2016, tmdbId: 66732, rating: "12", episodes: [{ season: 1, episode: 1, title: "La Disparition de Will Byers" }] },
  { title: "Breaking Bad", year: 2008, tmdbId: 1396, rating: "16", episodes: [{ season: 1, episode: 1, title: "Chute libre" }, { season: 2, episode: 1, title: "Sept trente-sept" }] },
  // Saison 1 seulement dans la bibliothèque : « saisons manquantes » côté Vigie.
  { title: "Cowboy Bebop", year: 1998, tmdbId: 30991, episodes: [{ season: 1, episode: 1, title: "Asteroid Blues" }] },
  // Tous publics, mais dans une bibliothèque refusée.
  { library: "reservedSeries", title: "La Pat' Patrouille", year: 2013, tmdbId: 57532, rating: "U", episodes: [{ season: 1, episode: 1, title: "Les Chiots sauvent un chaton" }] },
];

/** Les comptes du banc (mot de passe commun, jetable). */
export const BENCH_PASSWORD = "parental-Bench-2026";
export const ADMIN_NAME = "parental-admin";
/** ≤ 6 ans, tous les types non classés bloqués, étiquette bloquée, « Réservée » et « Réservée séries » refusées. */
export const RESTRICTED_NAME = "enfant6";
/** Aucun droit retiré : le témoin. */
export const FREE_NAME = "libre";
/** Bibliothèque « Films » seule, AUCUN contrôle parental : les droits de bibliothèque seuls. */
export const FILMS_ONLY_NAME = "filmsseuls";

export const RESTRICTED_MAX_RATING = 6;

/**
 * Titres EXTÉRIEURS (hors bibliothèque) que le faux Jellyseerr sert à Vigie :
 * de vrais identifiants TMDB, classifications réelles lues par le cœur chez TMDB.
 * Le banc ne suppose rien de leur classification : il la relit (oracle).
 */
export interface ExternalSpec {
  mediaType: "movie" | "tv";
  tmdbId: number;
  title: string;
}

const movie = (tmdbId: number, title: string): ExternalSpec => ({ mediaType: "movie", tmdbId, title });
const tv = (tmdbId: number, title: string): ExternalSpec => ({ mediaType: "tv", tmdbId, title });

export const EXTERNALS: ExternalSpec[] = [
  movie(2062, "Ratatouille"), movie(10681, "WALL·E"), movie(116149, "Paddington"), movie(269149, "Zootopie"),
  movie(277834, "Vaiana"), movie(808, "Shrek"), movie(348, "Alien"), movie(694, "Shining"), movie(680, "Pulp Fiction"),
  movie(807, "Seven"), movie(9552, "L'Exorciste"), movie(4232, "Scream"), movie(293660, "Deadpool"),
  movie(120, "Le Seigneur des anneaux"), movie(11, "La Guerre des étoiles"),
  tv(2316, "The Office"), tv(1399, "Game of Thrones"), tv(1402, "The Walking Dead"),
  tv(70523, "Dark"), tv(387, "Bob l'éponge"), tv(60625, "Rick et Morty"),
];
