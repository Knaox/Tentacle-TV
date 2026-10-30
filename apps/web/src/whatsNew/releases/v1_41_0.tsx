import type { WhatsNewRelease } from "../types";

/**
 * 1.41.0 — rien à montrer dans l'écran des nouveautés : des retouches d'Octave
 * (glisser, playlists, titres indisponibles, lecteur, onglet « Hors ligne »),
 * que les notes de version disent déjà.
 * L'entrée reste, vide : elle dit « rien », pas « oublié ».
 */
export const RELEASE_1_41_0: WhatsNewRelease = {
  version: "1.41.0",
  features: [],
};
