import type { WhatsNewRelease } from "../types";

/**
 * 1.42.0 — rien à montrer dans l'écran des nouveautés : des retouches d'Octave
 * (ordre des playlists hors ligne, titres illisibles grisés), que les notes de
 * version disent déjà.
 * L'entrée reste, vide : elle dit « rien », pas « oublié ».
 */
export const RELEASE_1_42_0: WhatsNewRelease = {
  version: "1.42.0",
  features: [],
};
