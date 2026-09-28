import type { WhatsNewRelease } from "../types";
import {
  CardsScene, DetailChainScene, DetailStageScene, PersonScene, RefineScene, WatchlistScene,
} from "../scenes/v1_24_0";

/**
 * 1.24.0 — la fiche et les cartes refaites, les listes à la forme de la
 * Bibliothèque, « Affiner » dans Recommandations. L'ordre suit un parcours :
 * on ouvre une fiche, on passe à quelqu'un du générique, on revient aux
 * cartes, on affine ce qui est proposé, on range sa liste, et un seul
 * « Retour » ramène d'une chaîne de fiches.
 *
 * Restent au changelog : les pages de connexion, d'inscription et de mot de
 * passe oublié (on ne les voit que déconnecté), l'écran des transferts hors
 * ligne, la liste et la fiche partagées (pages publiques).
 *
 * Les textes vivent dans l'espace i18n `whatsNew` (v1_24_0_<id>_title / _body).
 */
export const RELEASE_1_24_0: WhatsNewRelease = {
  version: "1.24.0",
  features: [
    { id: "detailStage", kind: "improved", titleKey: "v1_24_0_detailStage_title", bodyKey: "v1_24_0_detailStage_body", Scene: DetailStageScene },
    { id: "person", kind: "new", titleKey: "v1_24_0_person_title", bodyKey: "v1_24_0_person_body", Scene: PersonScene },
    { id: "cards", kind: "improved", titleKey: "v1_24_0_cards_title", bodyKey: "v1_24_0_cards_body", Scene: CardsScene },
    {
      id: "refine",
      kind: "new",
      titleKey: "v1_24_0_refine_title",
      bodyKey: "v1_24_0_refine_body",
      Scene: RefineScene,
      route: "/recommendations/refine",
    },
    {
      id: "watchlist",
      kind: "improved",
      titleKey: "v1_24_0_watchlist_title",
      bodyKey: "v1_24_0_watchlist_body",
      Scene: WatchlistScene,
      route: "/watchlist",
    },
    { id: "detailChain", kind: "improved", titleKey: "v1_24_0_detailChain_title", bodyKey: "v1_24_0_detailChain_body", Scene: DetailChainScene },
  ],
};
