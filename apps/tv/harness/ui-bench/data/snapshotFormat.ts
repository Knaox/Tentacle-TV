import type { MediaItem } from "@tentacle-tv/shared";

/**
 * Le format de l'instantané que tire `capture-snapshot.mjs` (compte Knaoxtest,
 * et lui seul) ou que fabrique `bench.mjs synth` en attendant.
 *
 * Les éléments sont les objets Jellyfin TELS QUE l'app les reçoit : une vue
 * ne voit jamais l'instantané, c'est la scène qui en tire les props — avec
 * les mêmes fonctions partagées que l'app (`cardMarkers`, `cardOverlay`…).
 * Les images sont des fichiers locaux, chemins relatifs au dossier `snapshot/` (ignoré par git).
 */

export type SnapshotImageType = "Primary" | "Thumb" | "Backdrop" | "Logo" | "Banner";

export interface SnapshotEntry {
  item: MediaItem;
  images: Partial<Record<SnapshotImageType, string>>;
}

export interface SnapshotShelf {
  id: string;
  title: string;
  itemIds: string[];
}

export interface Snapshot {
  version: 1;
  capturedAt: string;
  /** « Knaoxtest » pour un vrai instantané, « synthétique » sinon. */
  account: string;
  items: Record<string, SnapshotEntry>;
  /** Les ensembles choisis, par nature — des identifiants de `items`. */
  lists: {
    movies: string[];
    series: string[];
    anime: string[];
    episodes: string[];
    resume: string[];
    nextUp: string[];
    latest: string[];
    favorites: string[];
    watchlist: string[];
    people: string[];
    collections: string[];
  };
  /** Saisons d'une série, épisodes d'une saison (identifiants, dans l'ordre). */
  seasons: Record<string, string[]>;
  episodes: Record<string, string[]>;
  /** Les titres d'une personne, d'une saga (identifiants). */
  credits: Record<string, string[]>;
  /** La note perso du compte, sur 10, par élément. */
  ratings: Record<string, number>;
  /** Les étagères « Pour vous », telles que le serveur les rend. */
  shelves: SnapshotShelf[];
  /** Les bibliothèques du compte. */
  libraries: Array<{ id: string; name: string; collectionType: string | null }>;
}

export const EMPTY_SNAPSHOT: Snapshot = {
  version: 1,
  capturedAt: "",
  account: "aucun",
  items: {},
  lists: {
    movies: [], series: [], anime: [], episodes: [], resume: [], nextUp: [], latest: [],
    favorites: [], watchlist: [], people: [], collections: [],
  },
  seasons: {},
  episodes: {},
  credits: {},
  ratings: {},
  shelves: [],
  libraries: [],
};
