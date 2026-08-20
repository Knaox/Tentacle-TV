import {
  creerMagasinSautIntro,
  creerUseDecompteSautIntro,
  creerUseSautIntroAuto,
} from "@tentacle-tv/tv-core";

/**
 * « Passer l'intro automatiquement » sur la LG.
 *
 * Même magasin, même clé et même décompte que l'Apple TV et l'Android TV : ne
 * change ici que le stockage, `localStorage` au lieu de l'adaptateur natif.
 * Aucune réhydratation à prévoir — le navigateur lit tout de suite.
 */
export const magasinSautIntro = creerMagasinSautIntro(localStorage);

export const useSautIntroAuto = creerUseSautIntroAuto(magasinSautIntro);

export const useDecompteSautIntro = creerUseDecompteSautIntro(useSautIntroAuto);
