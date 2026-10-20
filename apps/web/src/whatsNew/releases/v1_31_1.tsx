import type { WhatsNewRelease } from "../types";

/**
 * 1.31.1 — rien à montrer dans l'écran des nouveautés : version corrective
 * du bureau (Watch Together avec le mobile, hors ligne réservé au compte
 * de l'ordinateur), ce que les notes de version disent déjà.
 * L'entrée reste, vide : elle dit « rien », pas « oublié ».
 */
export const RELEASE_1_31_1: WhatsNewRelease = {
  version: "1.31.1",
  features: [],
};
