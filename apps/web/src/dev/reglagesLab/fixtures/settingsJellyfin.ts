/**
 * Ce que les réglages lisent de JELLYFIN par le relais (`/api/jellyfin/…`) : les bibliothèques
 * du compte (Langues, Accueil, règles « avant la fin ») et ses favoris (le bandeau « titre
 * fixe » de l'accueil). Aucune image : les `ImageTags` sont vides, les écrans ont leurs replis.
 */

import type { LabRoute } from "../labFetch";
import type { LabRequest } from "./settingsShared";

export interface LabLibrary {
  id: string;
  name: string;
  /** Le type Jellyfin (`movies`, `tvshows`, `music`). */
  collectionType: string;
}

/** Les bibliothèques du serveur factice — les mêmes pour Jellyfin, les langues et la Famille. */
export const LAB_LIBRARIES: readonly LabLibrary[] = [
  { id: "lib-films", name: "Films", collectionType: "movies" },
  { id: "lib-series", name: "Séries", collectionType: "tvshows" },
  { id: "lib-animes", name: "Animés", collectionType: "tvshows" },
  { id: "lib-musique", name: "Musique", collectionType: "music" },
];

const MINUTE_TICKS = 600_000_000;

interface LabMovie {
  id: string;
  name: string;
  year: number;
  minutes: number;
  genres: string[];
  rating: number;
  overview: string;
}

/** Des films libres (Blender Foundation) : aucun titre du commerce dans le labo. */
const FAVORITES: readonly LabMovie[] = [
  { id: "it-sintel", name: "Sintel", year: 2010, minutes: 15, genres: ["Animation", "Fantastique"], rating: 7.4,
    overview: "Une jeune femme part à la recherche du dragon qu'elle a recueilli et élevé." },
  { id: "it-bbb", name: "Big Buck Bunny", year: 2008, minutes: 10, genres: ["Animation", "Comédie"], rating: 6.5,
    overview: "Un gros lapin placide décide de rendre la monnaie de leur pièce à trois rongeurs." },
  { id: "it-tos", name: "Tears of Steel", year: 2012, minutes: 12, genres: ["Science-fiction"], rating: 5.6,
    overview: "À Amsterdam, des scientifiques rejouent une rupture pour sauver le monde des robots." },
  { id: "it-cosmos", name: "Cosmos Laundromat", year: 2015, minutes: 12, genres: ["Animation", "Drame"], rating: 6.9,
    overview: "Sur une île désolée, un mouton lassé de tout croise un étrange représentant." },
  { id: "it-spring", name: "Spring", year: 2019, minutes: 8, genres: ["Animation", "Aventure"], rating: 6.8,
    overview: "Une bergère et son chien affrontent d'anciens esprits pour que revienne le printemps." },
];

const movieItem = (movie: LabMovie) => ({
  Id: movie.id,
  Name: movie.name,
  Type: "Movie",
  MediaType: "Video",
  IsFolder: false,
  ProductionYear: movie.year,
  RunTimeTicks: movie.minutes * MINUTE_TICKS,
  CommunityRating: movie.rating,
  OfficialRating: "Tous publics",
  Overview: movie.overview,
  Genres: movie.genres,
  Studios: [{ Name: "Blender Studio", Id: "st-blender" }],
  ProviderIds: {},
  ImageTags: {},
  BackdropImageTags: [],
  UserData: { IsFavorite: true, Played: true, PlayCount: 1, PlaybackPositionTicks: 0, Key: movie.id },
});

const page = (items: readonly unknown[]) => ({ Items: items, TotalRecordCount: items.length, StartIndex: 0 });

export function jellyfinSettingsRoutes(): readonly LabRoute[] {
  return [
    {
      path: /^\/api\/jellyfin\/Users\/[^/]+\/Views$/,
      reply: page(LAB_LIBRARIES.map((library) => ({
        Id: library.id,
        Name: library.name,
        Type: "CollectionFolder",
        CollectionType: library.collectionType,
        IsFolder: true,
        ImageTags: {},
        BackdropImageTags: [],
      }))),
    },
    {
      // Les favoris (films et séries) ; toute autre liste du compte : vide.
      path: /^\/api\/jellyfin\/Users\/[^/]+\/Items$/,
      reply: ({ url }: LabRequest) => page(url.searchParams.get("Filters")?.includes("IsFavorite") ? FAVORITES.map(movieItem) : []),
    },
  ];
}
