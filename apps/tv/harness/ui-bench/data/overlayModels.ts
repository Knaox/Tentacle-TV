import type { SessionMessageModel } from "../../../src/redesign/screens/overlays/SessionMessages";

/**
 * Les états des surimpressions. Les messages de l'administrateur sont saisis
 * par lui, dans SA langue : ils ne se traduisent pas (au banc non plus).
 * La barre est figée à la part du délai qui reste.
 */

export const ADMIN_MESSAGES: SessionMessageModel[] = [
  {
    id: 1,
    header: "Maintenance ce soir",
    text: "Le serveur redémarrera à 23 h pour une mise à jour de Jellyfin. La lecture sera coupée une dizaine de minutes.",
    remaining: 0.38,
  },
  {
    id: 2,
    header: "Nouveaux épisodes",
    text: "La suite de vos séries est arrivée cette nuit : bon visionnage !",
    remaining: 0.86,
  },
];

/** Ce que l'ancienne frontière d'erreur affichait en anglais, en petit. */
export const SCREEN_ERROR_DETAIL = "TypeError: undefined is not an object (evaluating 'item.UserData.PlayedPercentage')";
