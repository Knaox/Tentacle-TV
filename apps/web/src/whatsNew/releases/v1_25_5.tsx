import type { WhatsNewRelease } from "../types";

/**
 * 1.25.5 — entrée VIDE, en connaissance de cause, comme la 1.25.3.
 *
 * Un correctif qui ne se met pas en scène : les qualités réduites gardent une
 * définition que leur débit peut tenir (paliers à plancher mesuré, 540p et
 * 360p à la place du 480p), et la qualité automatique adapte le débit à
 * l'intérieur d'une définition. Il se voit dans une scène d'action, pas dans
 * une carte de nouveautés.
 */
export const RELEASE_1_25_5: WhatsNewRelease = {
  version: "1.25.5",
  features: [],
};
