import type { ScrubInputProfile } from "./scrubGestureTypes";

/**
 * Les flèches du lecteur sur ANDROID TV (la variante Apple TV :
 * `scrubInput.ios.ts`).
 *
 * Chaque flèche émet son key-down, ses répétitions de maintien, puis son
 * key-up (`enableKeyDownEvents`). Un appui simple ne se tranche donc qu'au
 * key-up — le down peut encore ouvrir un maintien —, et le maintien se
 * reconnaît au key-down resté sans key-up : le signal d'appui long natif
 * (`longLeft`) n'arrive pas partout (l'émulateur, clavier hôte, ne l'émet
 * jamais). La fin du maintien, elle, se déduit du silence des répétitions.
 */
export const SCRUB_INPUT: ScrubInputProfile = {
  tapOnRelease: true,
  holdFromKeyDown: true,
  // ~550-600 ms de maintien au total : assez pour ignorer un appui nerveux.
  holdArmMs: 250,
  holdEndAnnounced: false,
};
