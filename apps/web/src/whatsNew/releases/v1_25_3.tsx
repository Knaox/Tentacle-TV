import type { WhatsNewRelease } from "../types";

/**
 * 1.25.3 — entrée VIDE, en connaissance de cause, comme la 1.25.2.
 *
 * Des correctifs, et aucun ne se met en scène : la position quittée montrée
 * dès la sortie du lecteur (`useWatchStopInvalidation`, garde des arrêts
 * récents), la lecture directe qui tient pendant une panne, le logo de la
 * bannière d'accueil, « 1 saison ». Sur macOS et Windows, cette version
 * apporte aussi la lecture d'avance de la 1.25.1 (`media_warm`) et, sur macOS,
 * l'image qui ne vibre plus en plein écran (1.25.2) — ni l'une ni l'autre ne
 * se montre.
 */
export const RELEASE_1_25_3: WhatsNewRelease = {
  version: "1.25.3",
  features: [],
};
