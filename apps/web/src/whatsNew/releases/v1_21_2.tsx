import type { WhatsNewRelease } from "../types";
import { CollectionFiltersScene, SeriesRatingScene } from "../scenes/v1_21_2";

/**
 * 1.21.2 — deux nouveautés qui se MONTRENT : la note enfin posée sur un lot
 * d'épisodes, et Ma liste qui se filtre comme une bibliothèque.
 *
 * Le reste de la version est de la plomberie vidéo macOS — une fenêtre unique
 * sur Mac Intel, une courbe HDR qui ne s'impose plus à un écran SDR, une ombre
 * de fenêtre qui coûtait la moitié du processeur graphique. Ça se raconte très
 * bien dans le changelog, et très mal en trois cent soixante pixels de haut :
 * deux entrées honnêtes valent mieux qu'une scène qui invente.
 *
 * Les textes vivent dans l'espace i18n `whatsNew` (v1_21_2_<id>_title / _body).
 */
export const RELEASE_1_21_2: WhatsNewRelease = {
  version: "1.21.2",
  features: [
    {
      id: "ratings",
      kind: "improved",
      titleKey: "v1_21_2_ratings_title",
      bodyKey: "v1_21_2_ratings_body",
      Scene: SeriesRatingScene,
    },
    {
      id: "collectionFilters",
      kind: "new",
      titleKey: "v1_21_2_collectionFilters_title",
      bodyKey: "v1_21_2_collectionFilters_body",
      Scene: CollectionFiltersScene,
      route: "/watchlist",
    },
  ],
};
