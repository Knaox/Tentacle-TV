import type { WhatsNewRelease } from "../types";

/**
 * 1.27.0 — entrée VIDE pour l'instant, posée avec le numéro : le registre
 * doit connaître la version desktop courante (registry.test.ts).
 *
 * Candidats à une mise en scène, à trancher : la lecture qui tient pendant un
 * redémarrage de Jellyfin (serveur 1.24.0), la qualité réduite qui garde le
 * son d'origine et le HDR à la copie, le jumelage au dernier caractère.
 */
export const RELEASE_1_27_0: WhatsNewRelease = {
  version: "1.27.0",
  features: [],
};
