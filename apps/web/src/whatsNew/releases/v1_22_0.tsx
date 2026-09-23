import type { WhatsNewRelease } from "../types";

/**
 * 1.22.0 — entrée VIDE, en connaissance de cause.
 *
 * La version corrige ce que le serveur voit quand on ferme l'application en
 * pleine lecture : Jellyfin gardait le film « en cours » cinq minutes, faute
 * d'avoir reçu l'arrêt. Le correctif vit entre le programme et le serveur —
 * rien ne change à l'écran, et une scène qui le mettrait en scène inventerait.
 *
 * L'entrée existe quand même : elle dit « rien à montrer », là où son absence
 * laisserait supposer un oubli (cf. registry.test.ts).
 */
export const RELEASE_1_22_0: WhatsNewRelease = {
  version: "1.22.0",
  features: [],
};
