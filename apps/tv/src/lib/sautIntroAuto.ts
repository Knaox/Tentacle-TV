import { creerMagasinSautIntro, creerUseSautIntroAuto } from "@tentacle-tv/tv-core";
import { tvStorage } from "../storage/RNStorageAdapter";

/**
 * « Passer l'intro automatiquement », branché sur le stockage natif.
 *
 * Même magasin et même clé que la LG et que le web : ne change ici que
 * l'adaptateur. `RNStorageAdapter` convient tel quel — ses lectures sont
 * synchrones une fois `hydrate()` passé, comme `localStorage`.
 */
export const magasinSautIntro = creerMagasinSautIntro(tvStorage);

export const useSautIntroAuto = creerUseSautIntroAuto(magasinSautIntro);
