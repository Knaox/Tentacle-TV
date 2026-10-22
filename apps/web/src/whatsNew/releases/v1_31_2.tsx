import type { WhatsNewRelease } from "../types";

/**
 * 1.31.2 — rien à montrer dans l'écran des nouveautés : version corrective,
 * livrée sur Linux seulement (lecture selon la session, paquets, mises à jour,
 * sécurité), ce que les notes de version disent déjà.
 * L'entrée reste, vide : elle dit « rien », pas « oublié ».
 */
export const RELEASE_1_31_2: WhatsNewRelease = {
  version: "1.31.2",
  features: [],
};
