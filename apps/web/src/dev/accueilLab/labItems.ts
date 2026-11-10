/**
 * La bibliothèque factice du labo de l'accueil : des films libres (Blender) et des classiques
 * du domaine public — les titres du prototype validé (`.claude/refonte-ui/prototype`).
 *
 * L'identifiant d'un titre EST la clé de ses images (`p-<id>` l'affiche, `b-<id>` le fond) :
 * le banc de capture les sert depuis sa copie des images du prototype, jamais depuis `public/`.
 * Rien d'ici n'entre dans un paquet livré (le labo vaut `null` hors paquets de développement).
 */

import type { MediaItem } from "@tentacle-tv/shared";

const TICKS_PER_MINUTE = 600_000_000;

interface LabTitle {
  id: string;
  name: string;
  year: number;
  genres: string[];
  minutes: number;
  rating: number;
  overview: string;
  /** Position de reprise, de 0 à 1 — absent : jamais commencé. */
  progress?: number;
  favorite?: boolean;
  played?: boolean;
  /** Dans Ma liste. */
  listed?: boolean;
  /** Clé du fond quand elle n'est pas `b-<id>`. */
  backdrop?: string;
  /** Clé de l'affiche quand elle n'est pas `p-<id>`. */
  poster?: string;
}

const MOVIES: LabTitle[] = [
  { id: "sintel", name: "Sintel", year: 2010, genres: ["Fantastique", "Animation"], minutes: 15, rating: 7.4, progress: 0.3, favorite: true, backdrop: "b-sintel", overview: "Une jeune femme parcourt des terres hostiles à la recherche du dragon qu’elle a recueilli enfant." },
  { id: "tos", name: "Tears of Steel", year: 2012, genres: ["Science-fiction"], minutes: 12, rating: 6.6, progress: 0.62, backdrop: "b-tos1", overview: "À Amsterdam, une poignée de scientifiques tente de sauver le monde des robots en rejouant une rupture amoureuse." },
  { id: "spring", name: "Spring", year: 2019, genres: ["Fantastique", "Animation"], minutes: 8, rating: 7.5, listed: true, backdrop: "b-spring", overview: "Une bergère et son chien affrontent d’anciens esprits pour que le printemps revienne dans la vallée." },
  { id: "bbb", name: "Big Buck Bunny", year: 2008, genres: ["Comédie", "Animation"], minutes: 10, rating: 6.5, progress: 0.8, played: true, backdrop: "b-bbb", overview: "Un lapin géant et placide décide de se venger de trois rongeurs qui lui gâchent la vie." },
  { id: "cosmos", name: "Cosmos Laundromat", year: 2015, genres: ["Fantastique", "Animation"], minutes: 12, rating: 7.0, progress: 0.12, backdrop: "b-cosmos", overview: "Sur une île désolée, un mouton à bout rencontre un vendeur qui lui offre toutes les vies qu’il veut." },
  { id: "sprite", name: "Sprite Fright", year: 2021, genres: ["Horreur", "Comédie"], minutes: 10, rating: 6.8, overview: "Des adolescents en randonnée dérangent un peuple de petits champignons bien moins inoffensifs qu’ils n’en ont l’air." },
  { id: "charge", name: "Charge", year: 2022, genres: ["Action", "Science-fiction"], minutes: 4, rating: 6.9, overview: "Un vieil homme s’introduit dans une usine gardée par un robot pour y trouver une batterie." },
  { id: "vertigo", name: "Sueurs froides", year: 1958, genres: ["Thriller"], minutes: 128, rating: 8.3, overview: "Un ancien policier sujet au vertige est chargé de suivre une femme que le passé semble posséder." },
  { id: "nbnw", name: "La Mort aux trousses", year: 1959, genres: ["Thriller", "Aventure"], minutes: 136, rating: 8.3, overview: "Pris pour un autre, un publicitaire new-yorkais est traqué à travers les États-Unis." },
  { id: "charade", name: "Charade", year: 1963, genres: ["Comédie policière"], minutes: 113, rating: 7.9, listed: true, overview: "À Paris, une jeune veuve découvre que trois hommes cherchent la fortune que son mari a volée." },
  { id: "roman", name: "Vacances romaines", year: 1953, genres: ["Comédie romantique"], minutes: 118, rating: 8.0, overview: "Une princesse en visite officielle s’échappe pour une journée dans Rome, au bras d’un journaliste." },
  { id: "sunset", name: "Boulevard du crépuscule", year: 1950, genres: ["Drame"], minutes: 110, rating: 8.4, overview: "Un scénariste sans le sou devient le protégé d’une ancienne gloire du cinéma muet." },
  { id: "third", name: "Le Troisième Homme", year: 1949, genres: ["Film noir"], minutes: 104, rating: 8.1, overview: "Dans la Vienne occupée de l’après-guerre, un écrivain enquête sur la mort d’un ami." },
  { id: "casablanca", name: "Casablanca", year: 1942, genres: ["Drame", "Romance"], minutes: 102, rating: 8.5, overview: "À Casablanca, le patron d’un café retrouve la femme qu’il a aimée, et son mari résistant." },
  { id: "friday", name: "La Dame du vendredi", year: 1940, genres: ["Comédie"], minutes: 92, rating: 7.8, overview: "Un rédacteur en chef fait tout pour empêcher son ex-femme, sa meilleure journaliste, de se remarier." },
  { id: "rashomon", name: "Rashōmon", year: 1950, genres: ["Drame"], minutes: 88, rating: 8.2, overview: "Un crime raconté par quatre témoins, dont aucun ne dit la même chose." },
  { id: "seven", name: "Les Sept Mercenaires", year: 1960, genres: ["Western"], minutes: 128, rating: 7.7, overview: "Sept tireurs acceptent de défendre un village mexicain contre des pillards." },
  { id: "metropolis", name: "Metropolis", year: 1927, genres: ["Science-fiction"], minutes: 153, rating: 8.3, overview: "Dans une ville du futur, le fils du maître découvre le monde souterrain des ouvriers." },
  { id: "forbidden", name: "Planète interdite", year: 1956, genres: ["Science-fiction"], minutes: 98, rating: 7.5, overview: "Un vaisseau se pose sur une planète où ne survivent qu’un savant, sa fille et leur robot." },
  { id: "gojira", name: "Godzilla", year: 1954, genres: ["Science-fiction"], minutes: 96, rating: 7.5, overview: "Réveillé par des essais nucléaires, un monstre préhistorique surgit de la mer et marche sur Tokyo." },
  { id: "notld", name: "La Nuit des morts-vivants", year: 1968, genres: ["Horreur"], minutes: 96, rating: 7.8, overview: "Sept inconnus se barricadent dans une ferme isolée pendant que les morts se relèvent." },
];

/** Les images connues du banc : une affiche ou un fond absents retombent sur l'autre. */
const POSTERS = new Set(["bbb", "casablanca", "charade", "charge", "cosmos", "forbidden", "friday", "gojira", "metropolis", "nbnw", "notld", "rashomon", "roman", "seven", "sintel", "spring", "sprite", "sunset", "third", "tos", "vertigo"]);

function movie(title: LabTitle): MediaItem {
  const backdrop = title.backdrop;
  return {
    Id: title.id,
    Name: title.name,
    Type: "Movie",
    Overview: title.overview,
    Genres: title.genres,
    ProductionYear: title.year,
    CommunityRating: title.rating,
    RunTimeTicks: title.minutes * TICKS_PER_MINUTE,
    ImageTags: { Primary: POSTERS.has(title.id) ? `p-${title.id}` : (backdrop ?? "none") },
    BackdropImageTags: backdrop ? [backdrop] : [],
    UserData: {
      PlaybackPositionTicks: Math.round((title.progress ?? 0) * title.minutes * TICKS_PER_MINUTE),
      PlayedPercentage: title.progress ? title.progress * 100 : undefined,
      PlayCount: title.played ? 1 : 0,
      IsFavorite: title.favorite ?? false,
      Likes: title.listed ?? false,
      Played: title.played ?? false,
    },
  } as MediaItem;
}

export const LAB_MOVIES: MediaItem[] = MOVIES.map(movie);

/** La série du labo, et ses trois épisodes. */
export const LAB_SERIES: MediaItem = {
  Id: "cam",
  Name: "Caminandes",
  Type: "Series",
  Overview: "En Patagonie, le lama Koro se heurte à tout ce qui sépare un lama de son prochain repas : une route, une clôture, un manchot.",
  Genres: ["Comédie", "Animation"],
  ProductionYear: 2013,
  CommunityRating: 7.7,
  ImageTags: { Primary: "b-cam3" },
  BackdropImageTags: ["b-cam3"],
  UserData: { PlaybackPositionTicks: 0, PlayCount: 0, IsFavorite: false, Played: false, UnplayedItemCount: 2 },
} as MediaItem;

const EPISODES = [
  { id: "cam1", n: 1, name: "Llama Drama", minutes: 2, overview: "Koro veut traverser la route. La route n’est pas d’accord.", played: true },
  { id: "cam2", n: 2, name: "Gran Dillama", minutes: 3, overview: "Des baies bien rouges, une clôture électrique, et un lama qui ne renonce jamais.", progress: 0.45 },
  { id: "cam3", n: 3, name: "Llamigos", minutes: 3, overview: "L’hiver arrive. Koro et le manchot Oti se disputent la dernière baie de Patagonie." },
];

export const LAB_EPISODES: MediaItem[] = EPISODES.map((e) => ({
  Id: e.id,
  Name: e.name,
  Type: "Episode",
  Overview: e.overview,
  SeriesId: "cam",
  SeriesName: "Caminandes",
  SeasonId: "cam-s1",
  SeasonName: "Saison 1",
  IndexNumber: e.n,
  ParentIndexNumber: 1,
  ProductionYear: 2013,
  CommunityRating: 7.7,
  RunTimeTicks: e.minutes * TICKS_PER_MINUTE,
  ImageTags: { Primary: `b-${e.id}` },
  ParentBackdropItemId: "cam",
  ParentBackdropImageTags: ["b-cam3"],
  UserData: {
    PlaybackPositionTicks: Math.round((e.progress ?? 0) * e.minutes * TICKS_PER_MINUTE),
    PlayedPercentage: e.progress ? e.progress * 100 : undefined,
    PlayCount: e.played ? 1 : 0,
    IsFavorite: false,
    Played: e.played ?? false,
  },
} as MediaItem));

const byId = new Map<string, MediaItem>([...LAB_MOVIES, LAB_SERIES, ...LAB_EPISODES].map((item) => [item.Id, item]));

export function labItem(id: string): MediaItem {
  const item = byId.get(id);
  if (!item) throw new Error(`Titre de labo inconnu : ${id}`);
  return item;
}

export const labItems = (...ids: string[]): MediaItem[] => ids.map(labItem);

/** Le fichier d'image d'un titre : `p-…` l'affiche, `b-…` le fond ; `null`, il n'en a pas. */
export function labImageKey(id: string, type: string): string | null {
  const item = byId.get(id);
  if (!item) return null;
  if (type === "Primary") return item.ImageTags?.Primary ?? null;
  if (type === "Backdrop" || type === "Thumb") return item.BackdropImageTags?.[0] ?? item.ParentBackdropImageTags?.[0] ?? null;
  return null;
}

/** Ce que l'accueil du labo range, rangée par rangée (les titres du prototype). */
export const LAB_ROWS = {
  hero: ["sintel", "tos", "cam", "cosmos", "bbb"],
  resume: ["cam2", "tos", "sintel", "cosmos", "bbb"],
  latestMovies: ["sprite", "charge", "spring", "vertigo", "cosmos", "tos", "gojira", "sintel", "bbb", "charade", "metropolis"],
  classics: ["casablanca", "nbnw", "sunset", "roman", "third", "rashomon", "friday", "seven", "notld", "vertigo", "charade"],
  sciFi: ["forbidden", "metropolis", "tos", "gojira", "charge", "cosmos", "spring", "sintel"],
} as const;
