import type { WhatsNewRelease } from "../types";

/**
 * 1.21.3 — entrée VIDE, en connaissance de cause.
 *
 * La version corrige deux choses de plateforme : le panneau du bureau qui
 * s'intercalait entre la vidéo et notre fenêtre sous Linux, et l'icône de
 * l'application, restée carrée partout où le système ne la masque pas
 * lui-même. L'une ne se voit que sur un bureau KDE en plein écran, l'autre
 * vit HORS de l'application — dans la barre des tâches, dans le Dock. Ni
 * l'une ni l'autre ne se raconte en trois cent soixante pixels de haut, et
 * une scène qui les mettrait en scène inventerait.
 *
 * L'entrée existe quand même : elle dit « rien à montrer », là où son absence
 * laisserait supposer un oubli (cf. registry.test.ts).
 */
export const RELEASE_1_21_3: WhatsNewRelease = {
  version: "1.21.3",
  features: [],
};
