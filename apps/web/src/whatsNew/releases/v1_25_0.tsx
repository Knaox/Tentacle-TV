import type { WhatsNewRelease } from "../types";
import { AffinityScene, ExtrasScene, SagaScene, SeasonsScene, StatsScene } from "../scenes/v1_25_0";

/**
 * 1.25.0 — ce qu'on regarde, et avec qui : ses statistiques, l'Affinité de
 * Watch Together, puis la fiche — la saga d'un film, les saisons d'une série,
 * les bandes-annonces et les bonus.
 *
 * Restent au changelog : les cartes (« Lire » discret, même survol partout,
 * déjà mis en scène en 1.24.0), le hors ligne (seulement avec des titres téléchargés),
 * les recommandations et Affiner, les nouveautés de Jellyfin 12 (seulement
 * avec un serveur en 12), le bouton Copier réparé et la vue d'ensemble de
 * l'administration.
 *
 * Les textes vivent dans l'espace i18n `whatsNew` (v1_25_0_<id>_title / _body).
 */
export const RELEASE_1_25_0: WhatsNewRelease = {
  version: "1.25.0",
  features: [
    { id: "stats", kind: "new", titleKey: "v1_25_0_stats_title", bodyKey: "v1_25_0_stats_body", Scene: StatsScene, route: "/stats" },
    { id: "affinity", kind: "new", titleKey: "v1_25_0_affinity_title", bodyKey: "v1_25_0_affinity_body", Scene: AffinityScene },
    { id: "saga", kind: "new", titleKey: "v1_25_0_saga_title", bodyKey: "v1_25_0_saga_body", Scene: SagaScene },
    { id: "seasons", kind: "improved", titleKey: "v1_25_0_seasons_title", bodyKey: "v1_25_0_seasons_body", Scene: SeasonsScene },
    {
      id: "extras",
      kind: "improved",
      titleKey: "v1_25_0_extras_title",
      bodyKey: "v1_25_0_extras_body",
      Scene: ExtrasScene,
      route: "/help/trailers",
    },
  ],
};
