/**
 * La bibliothèque FACTICE du labo des fiches — celle du prototype validé : films libres de la
 * Blender Foundation (CC BY) et classiques du domaine public, avec leurs affiches (banc
 * `apps/web/bench/fiches/img/`). Aucune donnée d'un vrai serveur.
 *
 * Les titres sont écrits court (`LabTitle`), puis mis à la forme de Jellyfin (`labItems.ts`).
 * `tone` est le blurhash de l'image, réduit à sa couleur moyenne (calculée sur le fichier) :
 * c'est lui que `imageColorOf` lit pour peindre la couleur AVANT l'image.
 */

export interface LabTitle {
  id: string;
  name: string;
  year: number;
  genres: string[];
  minutes: number;
  rating: number;
  poster: string;
  backdrop?: string;
  series?: boolean;
  overview: string;
  /** Largeur de l'image du fichier : 3840 (4K) ou 1920. */
  width: 3840 | 1920;
  hdr?: boolean;
  audio: string[];
  subs: string[];
  /** Avancement de la lecture, 0 à 1. */
  progress?: number;
  played?: boolean;
  favorite?: boolean;
  cast?: string[];
  director?: string;
  added: string;
}

const BLENDER = "Blender Studio";

export const LAB_TITLES: LabTitle[] = [
  { id: "sintel", name: "Sintel", year: 2010, genres: ["Fantastique", "Animation"], minutes: 15, rating: 7.4, poster: "p-sintel", backdrop: "b-sintel", width: 3840, hdr: true, audio: ["eng"], subs: ["fre", "eng"], progress: 0.3, favorite: true, cast: ["Halina Reijn", "Thom Hoffman"], director: "Colin Levy", added: "2026-10-28", overview: "Une jeune femme parcourt des terres hostiles à la recherche du dragon qu'elle a recueilli enfant." },
  { id: "tos", name: "Tears of Steel", year: 2012, genres: ["Science-fiction"], minutes: 12, rating: 6.6, poster: "p-tos", backdrop: "b-tos1", width: 3840, audio: ["eng"], subs: ["fre"], progress: 0.62, cast: ["Derek de Lint", "Sergio Hasselbaink"], director: "Ian Hubert", added: "2026-10-30", overview: "À Amsterdam, une poignée de scientifiques tente de sauver le monde des robots en rejouant une rupture amoureuse." },
  { id: "spring", name: "Spring", year: 2019, genres: ["Fantastique", "Animation"], minutes: 8, rating: 7.5, poster: "p-spring", backdrop: "b-spring", width: 3840, audio: ["eng"], subs: [], director: "Andy Goralczyk", added: "2026-11-02", overview: "Une bergère et son chien affrontent d'anciens esprits pour que le printemps revienne dans la vallée." },
  { id: "bbb", name: "Big Buck Bunny", year: 2008, genres: ["Comédie", "Animation"], minutes: 10, rating: 6.5, poster: "p-bbb", backdrop: "b-bbb", width: 1920, audio: ["eng"], subs: [], played: true, director: "Sacha Goedegebure", added: "2026-09-12", overview: "Un lapin géant et placide décide de se venger de trois rongeurs qui lui gâchent la vie." },
  { id: "cosmos", name: "Cosmos Laundromat", year: 2015, genres: ["Fantastique", "Animation"], minutes: 12, rating: 7.0, poster: "p-cosmos", backdrop: "b-cosmos", width: 3840, audio: ["eng"], subs: ["fre"], progress: 0.12, director: "Mathieu Auvray", added: "2026-10-18", overview: "Sur une île désolée, un mouton à bout rencontre un vendeur qui lui offre toutes les vies qu'il veut." },
  { id: "sprite", name: "Sprite Fright", year: 2021, genres: ["Horreur", "Comédie"], minutes: 10, rating: 6.8, poster: "p-sprite", width: 3840, hdr: true, audio: ["eng", "fre"], subs: ["fre"], director: "Matthew Luhn", added: "2026-11-06", overview: "Des adolescents en randonnée dérangent un peuple de petits champignons bien moins inoffensifs qu'ils n'en ont l'air." },
  { id: "charge", name: "Charge", year: 2022, genres: ["Action", "Science-fiction"], minutes: 4, rating: 6.9, poster: "p-charge", width: 3840, audio: ["eng"], subs: [], director: "Hjalti Hjálmarsson", added: "2026-11-05", overview: "Un vieil homme s'introduit dans une usine gardée par un robot pour y trouver une batterie." },
  { id: "cam", name: "Caminandes", year: 2013, genres: ["Comédie", "Animation"], minutes: 3, rating: 7.7, poster: "b-cam2", backdrop: "b-cam3", series: true, width: 1920, audio: ["eng"], subs: [], director: "Pablo Vazquez", added: "2026-10-22", overview: "En Patagonie, le lama Koro se heurte à tout ce qui sépare un lama de son prochain repas : une route, une clôture, un manchot." },
  { id: "vertigo", name: "Sueurs froides", year: 1958, genres: ["Thriller"], minutes: 128, rating: 8.3, poster: "p-vertigo", width: 3840, hdr: true, audio: ["fre", "eng"], subs: ["fre"], cast: ["James Stewart", "Kim Novak"], director: "Alfred Hitchcock", added: "2026-11-01", overview: "Un ancien policier sujet au vertige est chargé de suivre une femme que le passé semble posséder." },
  { id: "nbnw", name: "La Mort aux trousses", year: 1959, genres: ["Thriller", "Aventure"], minutes: 136, rating: 8.3, poster: "p-nbnw", width: 3840, audio: ["fre"], subs: [], played: true, cast: ["Cary Grant", "Eva Marie Saint"], director: "Alfred Hitchcock", added: "2026-08-14", overview: "Pris pour un autre, un publicitaire new-yorkais est traqué à travers les États-Unis." },
  { id: "charade", name: "Charade", year: 1963, genres: ["Comédie", "Policier"], minutes: 113, rating: 7.9, poster: "p-charade", width: 1920, audio: ["fre"], subs: [], cast: ["Cary Grant", "Audrey Hepburn"], director: "Stanley Donen", added: "2026-10-09", overview: "À Paris, une jeune veuve découvre que trois hommes cherchent la fortune que son mari a volée." },
  { id: "roman", name: "Vacances romaines", year: 1953, genres: ["Comédie", "Romance"], minutes: 118, rating: 8.0, poster: "p-roman", width: 1920, audio: ["eng"], subs: ["fre"], favorite: true, cast: ["Audrey Hepburn", "Gregory Peck"], director: "William Wyler", added: "2026-07-30", overview: "Une princesse en visite officielle s'échappe pour une journée dans Rome, au bras d'un journaliste." },
  { id: "sunset", name: "Boulevard du crépuscule", year: 1950, genres: ["Drame"], minutes: 110, rating: 8.4, poster: "p-sunset", width: 3840, audio: ["eng"], subs: ["fre"], cast: ["Gloria Swanson", "William Holden"], director: "Billy Wilder", added: "2026-06-21", overview: "Un scénariste sans le sou devient le protégé d'une ancienne gloire du cinéma muet." },
  { id: "third", name: "Le Troisième Homme", year: 1949, genres: ["Film noir", "Thriller"], minutes: 104, rating: 8.1, poster: "p-third", width: 3840, audio: ["eng"], subs: ["fre"], progress: 0.48, cast: ["Joseph Cotten", "Orson Welles"], director: "Carol Reed", added: "2026-09-03", overview: "Dans la Vienne occupée de l'après-guerre, un écrivain enquête sur la mort d'un ami." },
  { id: "casa", name: "Casablanca", year: 1942, genres: ["Drame", "Romance"], minutes: 102, rating: 8.5, poster: "p-casablanca", width: 3840, audio: ["fre", "eng"], subs: ["fre"], played: true, favorite: true, cast: ["Humphrey Bogart", "Ingrid Bergman"], director: "Michael Curtiz", added: "2026-05-11", overview: "À Casablanca, le patron d'un café retrouve la femme qu'il a aimée, et son mari résistant." },
  { id: "friday", name: "La Dame du vendredi", year: 1940, genres: ["Comédie"], minutes: 92, rating: 7.8, poster: "p-friday", width: 1920, audio: ["eng"], subs: ["fre"], cast: ["Cary Grant", "Rosalind Russell"], director: "Howard Hawks", added: "2026-04-02", overview: "Un rédacteur en chef fait tout pour empêcher son ex-femme, sa meilleure journaliste, de se remarier." },
  { id: "rashomon", name: "Rashōmon", year: 1950, genres: ["Drame"], minutes: 88, rating: 8.2, poster: "p-rashomon", width: 3840, audio: ["jpn"], subs: ["fre", "eng"], cast: ["Toshirō Mifune", "Machiko Kyō"], director: "Akira Kurosawa", added: "2026-08-25", overview: "Un crime raconté par quatre témoins, dont aucun ne dit la même chose." },
  { id: "seven", name: "Les Sept Mercenaires", year: 1960, genres: ["Western"], minutes: 128, rating: 7.7, poster: "p-seven", width: 3840, audio: ["fre"], subs: [], cast: ["Yul Brynner", "Steve McQueen"], director: "John Sturges", added: "2026-03-17", overview: "Sept tireurs acceptent de défendre un village mexicain contre des pillards." },
  { id: "metro", name: "Metropolis", year: 1927, genres: ["Science-fiction"], minutes: 153, rating: 8.3, poster: "p-metropolis", width: 1920, audio: [], subs: ["fre"], cast: ["Brigitte Helm", "Gustav Fröhlich"], director: "Fritz Lang", added: "2026-02-08", overview: "Dans une ville du futur, le fils du maître découvre le monde souterrain des ouvriers." },
  { id: "forbidden", name: "Planète interdite", year: 1956, genres: ["Science-fiction"], minutes: 98, rating: 7.5, poster: "p-forbidden", width: 3840, audio: ["fre"], subs: [], cast: ["Walter Pidgeon", "Anne Francis"], director: "Fred M. Wilcox", added: "2026-09-27", overview: "Un vaisseau se pose sur une planète où ne survivent qu'un savant, sa fille et leur robot." },
  { id: "gojira", name: "Godzilla", year: 1954, genres: ["Science-fiction", "Horreur"], minutes: 96, rating: 7.5, poster: "p-gojira", width: 3840, audio: ["jpn"], subs: ["fre"], cast: ["Akira Takarada", "Momoko Kōchi"], director: "Ishirō Honda", added: "2026-10-12", overview: "Réveillé par des essais nucléaires, un monstre préhistorique surgit de la mer et marche sur Tokyo." },
  { id: "notld", name: "La Nuit des morts-vivants", year: 1968, genres: ["Horreur"], minutes: 96, rating: 7.8, poster: "p-notld", width: 3840, audio: ["eng"], subs: ["fre"], cast: ["Duane Jones", "Judith O'Dea"], director: "George A. Romero", added: "2026-10-31", overview: "Sept inconnus se barricadent dans une ferme isolée pendant que les morts se relèvent." },
];

export interface LabEpisode {
  id: string;
  season: number;
  index: number;
  name: string;
  minutes: number;
  still: string;
  overview: string;
  progress?: number;
  played?: boolean;
}

/** Les épisodes de la seule série : Caminandes, une saison et un spécial. */
export const LAB_EPISODES: LabEpisode[] = [
  { id: "cam1", season: 1, index: 1, name: "Llama Drama", minutes: 2, still: "b-cam1", played: true, overview: "Koro veut traverser la route. La route n'est pas d'accord." },
  { id: "cam2", season: 1, index: 2, name: "Gran Dillama", minutes: 3, still: "b-cam2", progress: 0.45, overview: "Des baies bien rouges, une clôture électrique, et un lama qui ne renonce jamais." },
  { id: "cam3", season: 1, index: 3, name: "Llamigos", minutes: 3, still: "b-cam3", overview: "L'hiver arrive. Koro et le manchot Oti se disputent la dernière baie de Patagonie." },
  { id: "cam0", season: 0, index: 1, name: "Dans les coulisses de Caminandes", minutes: 6, still: "b-cam1", overview: "L'équipe du studio raconte la fabrication des trois épisodes." },
];

export const LAB_SERIES_ID = "cam";
export const LAB_COLLECTION_ID = "blender";
export const LAB_COLLECTION_NAME = "Les films ouverts de Blender";
/** Les films de la collection (un BoxSet) : ceux du studio. */
export const LAB_COLLECTION_TITLES = ["sintel", "tos", "spring", "bbb", "cosmos", "sprite", "charge"];
export const LAB_STUDIO = BLENDER;

/** Couleur moyenne de chaque image, à la forme d'un blurhash (`blurhashAverageColor`). */
export const LAB_TONES: Record<string, string> = {
  "b-bbb": "L0J[F|", "b-bbb2": "L0HB*8", "b-cam1": "L0J6j0", "b-cam2": "L0N0n]", "b-cam3": "L0ECI6", "b-cosmos": "L0F$tv",
  "b-sintel": "L0FhX;", "b-sintel1": "L08qZ:", "b-spring": "L0CGoa", "b-tos1": "L0BNTd", "b-tos2": "L0F={f", "p-bbb": "L0Maw{",
  "p-casablanca": "L0JQ.y", "p-charade": "L0Mjmq", "p-charge": "L03J17", "p-cosmos": "L0ATAw", "p-forbidden": "L0E{,z",
  "p-friday": "L0HL6Z", "p-gojira": "L0I53j", "p-metropolis": "L0JQo,", "p-nbnw": "L0Lzmj", "p-notld": "L0HxQh",
  "p-rashomon": "L0MGK+", "p-roman": "L0Kwjc", "p-seven": "L0L|@[", "p-sintel": "L04e+y", "p-spring": "L04|7b",
  "p-sprite": "L068%8", "p-sunset": "L0L_Ie", "p-third": "L0ByZ|", "p-tos": "L0D0P,", "p-vertigo": "L0N@Wh",
};

/** Une bibliothèque de plus, TOUJOURS vide : l'état « Cette bibliothèque est vide ». */
export const LAB_LIBRARIES = [
  { Id: "films", Name: "Films", CollectionType: "movies" },
  { Id: "series", Name: "Séries", CollectionType: "tvshows" },
  { Id: "vide", Name: "Documentaires", CollectionType: "movies" },
] as const;
