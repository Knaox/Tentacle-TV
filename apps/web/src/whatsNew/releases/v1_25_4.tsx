import type { WhatsNewRelease } from "../types";
import { LatestGroupedScene } from "../scenes/v1_25_4";

/**
 * 1.25.4 — « Derniers ajouts » regroupés par série : les épisodes et les
 * saisons arrivés ensemble ne font plus qu'une carte, qui dit ce qu'elle
 * apporte et s'ouvre sur la saison du dernier ajout. Le regroupement vient
 * du serveur 1.22.2 ; face à un serveur plus ancien, le client regroupe
 * lui-même les épisodes qui se suivent (« 3 nouveaux épisodes »).
 *
 * Les textes vivent dans l'espace i18n `whatsNew` (v1_25_4_<id>_title / _body).
 */
export const RELEASE_1_25_4: WhatsNewRelease = {
  version: "1.25.4",
  features: [
    { id: "latest", kind: "improved", titleKey: "v1_25_4_latest_title", bodyKey: "v1_25_4_latest_body", Scene: LatestGroupedScene, route: "/" },
  ],
};
